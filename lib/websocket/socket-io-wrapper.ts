/// <reference path='../../typings/tsd.d.ts' />

import bunyan = require('bunyan');
import SocketIO = require('socket.io');
import BAPI = require('../blpapi-wrapper');
import Interface = require('../interface');
import SocketEventEmitterAdapter = require('./socket-event-emitter-adapter');

export = SocketIOWrapper;

class SocketIOWrapper extends SocketEventEmitterAdapter implements Interface.ISocket {
    private socket: SocketIO.Socket;
    private _log: bunyan.Logger;
    public blpSession: BAPI.Session;

    constructor(s: SocketIO.Socket, l: bunyan.Logger) {
        super(s);
        this.socket = s;
        this._log = l;
    }

    get log(): bunyan.Logger {
        return this._log;
    }

    isConnected(): boolean {
        return this.socket.connected;
    }

    getIP(): string {
        return (<any>this.socket).handshake.headers['x-forwarded-for']
               || (<any>this.socket).conn.remoteAddress;
    }

    getCert(): any {
        return this.socket.request.connection.getPeerCertificate();
    }

    disconnect(): void {
        this.socket.disconnect(true);
    }

    send(name: string, ...args: any[]): void {
        this.socket.emit(name, args);
    }

}
