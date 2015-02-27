/// <reference path='../typings/tsd.d.ts' />

import restify = require('restify');
import bunyan = require('bunyan');
import BAPI = require('./blpapi-wrapper');
import Session = require('./apisession/session');

export interface IOurRequest extends restify.Request {
    clientCert?: any;
    blpSession: BAPI.ISession;
    apiSession?: Session;
}

export interface IBufferedData<T> {
    buffer: T[];
    overflow: number;
}

export interface IOurResponse extends restify.Response {
    sendChunk?: (data: any) => void;
    sendEnd?: (status: any, message: string) => void;
    sendError?: (err: Error) => any;
}

export interface ISocket extends NodeJS.EventEmitter {
    // PROPERTIES
    log: bunyan.Logger; // Add bunyan logger to socket
    blpSession: BAPI.ISession;  // Add blpSession to socket

    // MANIPULATORS
    sendData(correlationId: number, data: any): void;
    sendError(message: string): void;
    notifyConnected(): void;
    notifySubscribed(): void;
    notifyUnsubscribed(all: boolean): void;
    disconnect(): void;

    // ACCESSORS
    isConnected(): boolean;
    getIP(): string;
    getCert(): any;
}
