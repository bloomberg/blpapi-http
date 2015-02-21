/// <reference path='../../typings/tsd.d.ts' />

import bunyan = require('bunyan');
import SocketIO = require('socket.io');
import SocketBaseImpl = require('./socket-base-impl');

export = SocketIOWrapper;

class SocketIOWrapper extends SocketBaseImpl {
    // DATA
    private socket: SocketIO.Socket;

    // PROTECTED MANIPULATORS
    protected send(name: string, ...args: any[]): void {
        this.socket.emit(name, args);
    }

    // CREATORS
    constructor(s: SocketIO.Socket, l: bunyan.Logger) {
        super(l, s);
        this.socket = s;
    }

    // MANIPULATORS
    disconnect(): void {
        this.socket.disconnect(true);
    }

    // ACCESSORS
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
}
