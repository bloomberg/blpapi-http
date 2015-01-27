/// <reference path='../../typings/tsd.d.ts' />

import events = require('events');
import _ = require('lodash');
import bunyan = require('bunyan');
import webSocket = require('ws');
import BAPI = require('../blpapi-wrapper');
import Interface = require('../interface');

export = WSWrapper;

class WSWrapper extends events.EventEmitter implements Interface.ISocket {
    private socket: webSocket;
    private _log: bunyan.Logger;
    public blpSession: BAPI.Session;

    constructor(s: webSocket, l: bunyan.Logger) {
        super();
        this.socket = s;
        this._log = l;

        this.socket.on('message', (message: string): void => {
            var obj: any;
            try {
                obj = JSON.parse(message);
            } catch (ex) {
                this.log.debug('error parsing message object:', ex);
                this.send('err', ex);
                return;
            }

            if (!_.has(obj, 'type') || !_.isString(obj.type)) {
                this.log.debug('Invalid message type received.');
                this.send('err', { message: 'Invalid message type received.'});
                return;
            }

            if (obj.type !== 'disconnect') {
                this.emit(obj.type, obj.data);
            }
        });

        this.socket.on('close', (): void => {
            this.emit('disconnect');
        });
    }

    get log(): bunyan.Logger {
        return this._log;
    }

    isConnected(): boolean {
        return this.socket.readyState === webSocket.OPEN;
    }

    getIP(): string {
        return this.socket.upgradeReq.headers['x-forwarded-for']
               || this.socket.upgradeReq.connection.remoteAddress;
    }

    getCert(): any {
        return (<any>this.socket).upgradeReq.connection.getPeerCertificate();
    }

    disconnect(): void {
        this.socket.close();
    }

    send(name: string, ...args: any[]): void {
        this.socket.send(JSON.stringify({type: name, data: args}));
    }
}
