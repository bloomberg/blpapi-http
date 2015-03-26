/// <reference path='../../typings/tsd.d.ts' />

import events = require('events');
import bunyan = require('bunyan');
import blpapi = require('blpapi');
import Interface = require('../interface');
import emitterAdapter = require('./socket-event-emitter-adapter');

export = SocketBaseImpl;

class SocketBaseImpl extends emitterAdapter.SocketEventEmitterAdapter implements Interface.ISocket {

    // DATA
    private _logger: bunyan.Logger;
    private _blpapiSession: blpapi.Session;

    // PROTECTED MANIPULATORS
    protected send(name: string, arg?: any): void {
        throw new Error('send() must be implemented');
    }

    // CREATORS
    constructor(logger: bunyan.Logger,
                emitterToAdapt: emitterAdapter.EventEmitter = new events.EventEmitter())
    {
        super(emitterToAdapt);
        this._logger = logger;
    }

    // MANIPULATORS
    sendData(correlationId: number, data: any): void {
        this.send('data', {
            correlationId: correlationId,
            data: data
        });
    }

    sendError(message: string): void {
        this.send('err', { message: message });
    }

    notifyConnected(): void {
        this.send('connected');
    }

    notifySubscribed(correlationIds: number[]): void {
        this.send('subscribed', correlationIds);
    }

    notifyUnsubscribed(correlationIds: number[]): void {
        this.send('unsubscribed', correlationIds);
    }

    disconnect(): void {
        throw new Error('disconnect() must be implemented');
    }

    // PROPERTIES
    /* tslint:disable:typedef */
    set blpSession(session: blpapi.Session) {
        this._blpapiSession = session;
    }
    /* tslint:enable:typedef */
    get blpSession(): blpapi.Session {
        return this._blpapiSession;
    }

    // ACCESSORS
    get log(): bunyan.Logger {
        return this._logger;
    }

    isConnected(): boolean {
        throw new Error('isConnected() must be implemented');
    }

    getIP(): string {
        throw new Error('getIP() must be implemented');
    }

    getCert(): any {
        throw new Error('getCert() must be implemented');
    }
}
