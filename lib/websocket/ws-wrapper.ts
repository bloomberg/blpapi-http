/// <reference path='../../typings/tsd.d.ts' />

import _ = require('lodash');
import bunyan = require('bunyan');
import webSocket = require('ws');
import SocketBaseImpl = require('./socket-base-impl');

export = WSWrapper;

class WSWrapper extends SocketBaseImpl {
    // DATA
    private socket: webSocket;

    // PROTECTED MANIPULATORS
    protected send(name: string, arg?: any): void {
        this.socket.send(JSON.stringify({type: name, data: arg}));
    }

    // CREATORS
    constructor(s: webSocket, l: bunyan.Logger) {
        super(l);
        this.socket = s;

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

    // MANIPULATORS
    disconnect(): void {
        this.socket.close();
    }

    // ACCESSORS
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
}
