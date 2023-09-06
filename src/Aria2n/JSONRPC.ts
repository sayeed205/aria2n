import WebSocket from 'isomorphic-ws';
import { Status } from '../types';

class Client {
    private static requestId = 0;
    private ws: WebSocket | null = null;
    private _messageHandlers: Array<Function> = [];
    constructor(private readonly url: string, private readonly secret: string) {
        this.url = url;
        this.secret = secret;
        this.ws = new WebSocket(this.url);

        this.ws.addEventListener('message', () => {
            this.onMessage.bind(this);
        });
    }

    get sid(): number {
        return Client.requestId++;
    }

    async request(method: string, params: any[] = []): Promise<unknown> {
        let id = this.sid;
        if (this.secret) {
            params.unshift(`token:${this.secret}`);
        }
        const request = {
            jsonrpc: '2.0',
            id,
            method,
            params,
        };

        const ws = this.ws;
        return new Promise((resolve, reject) => {
            if (!ws) {
                // return reject('No WebSocket connection');
                // todo)) fall back to HTTP
                return;
            }
            switch (ws.readyState) {
                case ws.CONNECTING:
                    ws.onopen = () => {
                        // this.waitForConnection(ws, () => {
                        ws && ws.send(JSON.stringify(request));
                        // });
                    };
                    break;
                case ws.OPEN:
                    ws.send(JSON.stringify(request));
                    break;
                case ws.CLOSED:
                    this.ws = null;
                    let error = new Error('Aria2 is unreachable');
                    error.name = 'ConnectionError';
                    return reject(error);
                default:
                    error = new Error(`Unknown readyState: ${ws.readyState}`);
                    error.name = 'ConnectionError';
                    return reject(error);
            }
            ws.onmessage = event => {
                let response = JSON.parse(event.data.toString()) as unknown as {
                    id: number;
                    result: Status[];
                    jsonrpc: '2.0';
                };
                if (response.id == request.id) resolve(response.result);
            };
            ws.close = () => {
                this.ws = null;
                reject(new Error('WebSocket is closed'));
            };
            ws.onerror = () => {
                this.ws = null;
                reject(new Error('Aria2 is unreachable'));
            };
        });
    }

    async listen(cb: (data: any) => void) {
        const ws = this.ws;
        if (!ws) {
            return;
        }
        ws.onmessage = event => {
            const data = JSON.parse(event.data.toString());
            cb(data);
        };
    }

    private onMessage(event: MessageEvent) {
        try {
            let data = JSON.parse(event.data);
            data.source = this;
            this._messageHandlers.forEach(handle => {
                handle(data);
            });
        } catch (error) {
            console.error('got an invalid message');
        }
    }
}

export default Client;
