// import {
//     Client,
//     HTTPTransport,
//     RequestManager,
//     WebSocketTransport,
// } from '@open-rpc/client-js';
import Client from './JSONRPC';
// import { EventEmitter } from "events";

import { Aria2Version, Aria2nOptions, Key, Status, onProgress } from '../types';

export class Aria2n {
    private client: Client | null = null;

    constructor(
        private readonly options: Aria2nOptions = {
            host: 'localhost',
            port: 6800,
            path: '/jsonrpc',
            secure: false,
            secret: '',
        }
    ) {
        this.options = options;
        this.client = new Client(
            `ws://${this.options.host}:${this.options.port}/jsonrpc`,
            this.options.secret!
        );
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
        const Status = (await this.client?.request('aria2.tellStatus', [
            gid,
            keys,
        ])) as Partial<Status>;
        return Status;
    }

    async getActive(keys: Key[] = []) {
        const active = (await this.client?.request('aria2.tellActive', [
            keys,
        ])) as Partial<Status>[];

        return active;
    }

    async getWaiting(offset: number, limit: number, keys: Key[] = []) {
        const waiting = (await this.client?.request('aria2.tellWaiting', [
            offset,
            limit,
            keys,
        ])) as Partial<Status>[];
        return waiting;
    }

    async getStopped(offset: number, limit: number, keys: Key[] = []) {
        const stopped = (await this.client?.request('aria2.tellStopped', [
            offset,
            limit,
            keys,
        ])) as Partial<Status>[];
        return stopped;
    }

    async getVersion() {
        const version = (await this.client?.request(
            'aria2.getVersion',
            []
        )) as Aria2Version;
        return version;
    }

    // async onDownloadPause() {
    //     await this.client?.notify(
    //          'aria2.onDownloadPause',
    //          ["console.log('test)"],
    //     );
    // }
}
