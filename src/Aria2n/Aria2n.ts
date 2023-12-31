// import {
//     Client,
//     HTTPTransport,
//     RequestManager,
//     WebSocketTransport,
// } from '@open-rpc/client-js';
import Client from './JSONRPC';
// import { EventEmitter } from "events";

import {
    AddUriOptions,
    Aria2Version,
    Aria2nOptions,
    Key,
    Status,
    downloads,
} from '../types';
import { humanReadableBytes } from '../utils';

export class Aria2n {
    private client: Client | null = null;
    status: boolean = false;

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
        try {
            this.client = new Client(
                `ws://${this.options.host}:${this.options.port}/jsonrpc`,
                this.options.secret!
            );
            this.status = true;
        } catch (error) {
            console.log(error);
            this.status = false;
        }
    }

    connect() {
        try {
            if (!this.status) {
                this.client = new Client(
                    `ws://${this.options.host}:${this.options.port}/jsonrpc`,
                    this.options.secret!
                );
                this.status = true;
            }
        } catch (error) {
            // console.log(error);
            this.status = false;
            throw new Error('Unable to connect to aria2 ' + error);
        }
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

    async onProgress(cb: (downloads: downloads[]) => void) {
        while (true) {
            const downloads = await this.getDownloads();

            cb(downloads);

            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    async getStatus(gid: string, keys: Key[] = []) {
        const Status = (await this.client?.request('aria2.tellStatus', [
            gid,
            keys,
        ])) as Partial<Status>;
        return this.formatDownload(Status);
    }

    async getActive(keys: Key[] = []) {
        const active = (await this.client?.request('aria2.tellActive', [
            keys,
        ])) as Partial<Status>[];

        return active.map(active => this.formatDownload(active));
    }

    async getWaiting(offset: number, limit: number, keys: Key[] = []) {
        const waiting = (await this.client?.request('aria2.tellWaiting', [
            offset,
            limit,
            keys,
        ])) as Partial<Status>[];
        return waiting.map(waiting => this.formatDownload(waiting));
    }

    async getStopped(offset: number, limit: number, keys: Key[] = []) {
        const stopped = (await this.client?.request('aria2.tellStopped', [
            offset,
            limit,
            keys,
        ])) as Partial<Status>[];
        return stopped.map(stopped => this.formatDownload(stopped));
    }

    async getVersion() {
        const version = (await this.client?.request(
            'aria2.getVersion',
            []
        )) as Aria2Version;
        return version;
    }

    async pauseDownload(gid: string) {
        await this.client?.request('aria2.pause', [gid]);
    }

    async pauseAllDownloads() {
        await this.client?.request('aria2.pauseAll', []);
    }

    async resumeDownload(gid: string) {
        await this.client?.request('aria2.unpause', [gid]);
    }

    async resumeAllDownloads() {
        await this.client?.request('aria2.unpauseAll', []);
    }

    async removeDownload(gid: string) {
        await this.client?.request('aria2.remove', [gid]);
    }

    async addUri(uris: string[] | string, options: AddUriOptions = {}) {
        if (typeof uris === 'string') {
            uris = [uris];
        }
        await this.client?.request('aria2.addUri', [uris, options]);
    }

    // async onDownloadPause() {
    //     await this.client?.notify(
    //          'aria2.onDownloadPause',
    //          ["console.log('test)"],
    //     );
    // }

    private formatDownload(download: Partial<Status>): downloads {
        const gid = download.gid!;
        const status = download.status!;
        const downloadSpeed = humanReadableBytes(
            Number(download.downloadSpeed),
            2,
            ' ',
            '/s'
        );
        const completedLength = humanReadableBytes(
            Number(download.completedLength),
            2,
            ' ',
            ''
        );
        const totalLength = humanReadableBytes(
            Number(download.totalLength),
            2,
            ' ',
            ''
        );
        const progress =
            (Number(download.completedLength) / Number(download.totalLength)) *
            100;
        let name = '';
        let isTorrent = false;
        if (download.bitTorrent) {
            name = download.bitTorrent.info.name;
            isTorrent = true;
        } else {
            name = download.files![0].path.split('/').pop()!;
        }

        const path = download.dir!;

        return {
            gid,
            status,
            downloadSpeed,
            completedLength,
            totalLength,
            progress,
            name,
            isTorrent,
            path,
        };
    }
}
