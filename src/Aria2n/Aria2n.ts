import {
    Client,
    HTTPTransport,
    RequestManager,
    WebSocketTransport,
} from '@open-rpc/client-js';

import { Aria2Version, Aria2nOptions, Key, Status, onProgress } from '../types';

export class Aria2n {
    private client: Client | null = null;

    constructor(
        private readonly options: Aria2nOptions = {
            /**
             * use websocket or not
             * @default true
             */
            ws: true,
            host: 'localhost',
            port: 6800,
            secure: false,
            secret: '',
        }
    ) {
        this.options = options;
        this.initiateRPCClient();
    }

    async getDownloads(gids: string[] = [], keys: Key[] = []) {
        if (gids.length > 0) {
            const downloads = [];
            for (const gid of gids) {
                const download = await this.getStatus(gid, keys);
                downloads.push(download);
            }
            return downloads;
        }
        const active = await this.getActive(keys);
        const waiting = await this.getWaiting(0, 1000, keys);
        const stopped = await this.getStopped(0, 1000, keys);
        const downloads = [...active, ...waiting, ...stopped];
        return downloads;
    }

    async onProgress(cb: (downloads: onProgress[]) => void) {
        while (true) {
            const downloads = await this.getDownloads(
                [],
                [
                    'completedLength',
                    'gid',
                    'totalLength',
                    'status',
                    'downloadSpeed',
                ]
            ).then(downloads =>
                downloads.map(downloads => {
                    return {
                        gid: downloads.gid,
                        completedLength: downloads.completedLength,
                        totalLength: downloads.totalLength,
                        status: downloads.status,
                        downloadSpeed: downloads.downloadSpeed,
                    } as unknown as onProgress;
                })
            );

            cb(downloads);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async getStatus(gid: string, keys: Key[] = []) {
        const Status = (await this.client?.request({
            method: 'aria2.tellStatus',
            params: [gid, keys],
        })) as Partial<Status>;
        return Status;
    }

    async getActive(keys: Key[] = []) {
        const active = (await this.client?.request({
            method: 'aria2.tellActive',
            params: [keys],
        })) as Partial<Status>[];

        return active;
    }

    async getWaiting(offset: number, limit: number, keys: Key[] = []) {
        const waiting = (await this.client?.request({
            method: 'aria2.tellWaiting',
            params: [offset, limit, keys],
        })) as Partial<Status>[];
        return waiting;
    }

    async getStopped(offset: number, limit: number, keys: Key[] = []) {
        const stopped = (await this.client?.request({
            method: 'aria2.tellStopped',
            params: [offset, limit, keys],
        })) as Partial<Status>[];
        return stopped;
    }

    async getVersion() {
        const version = (await this.client?.request({
            method: 'aria2.getVersion',
            params: [],
        })) as Aria2Version;
        return version;
    }

    private get isWS() {
        return this.options.ws;
    }

    private initiateRPCClient() {
        if (this.isWS) {
            this.initiateWSClient();
        } else {
            this.initiateHTTPClient();
        }
    }

    private initiateWSClient() {
        const transport = new HTTPTransport(
            `http://${this.options.host}:${this.options.port}/jsonrpc`
        );
        const client = new Client(new RequestManager([transport]));
        this.client = client;
    }

    private initiateHTTPClient() {
        const transport = new WebSocketTransport(
            `ws://${this.options.host}:${this.options.port}/jsonrpc`
        );
        const client = new Client(new RequestManager([transport]));
        this.client = client;
    }
}
