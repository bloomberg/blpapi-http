/// <reference path='../typings/tsd.d.ts' />

import restify = require('restify');
import bunyan = require('bunyan');
import BAPI = require('./blpapi-wrapper');
import Session = require('./apisession/session');

export interface IOurRequest extends restify.Request {
    clientCert?: any;
    blpSession: BAPI.Session;
    apiSession?: Session;
}

export interface IBufferedData<T> {
    buffer: T[];
    overflow: number;
}

export interface IOurResponse extends restify.Response {
    sendChunk?: (data: any) => Promise<void>;
    sendEnd?: (status: any, message: string) => Promise<void>;
}

export interface ISocket extends NodeJS.EventEmitter {
    log: bunyan.Logger; // Add bunyan logger to socket
    blpSession: BAPI.Session;  // Add blpSession to socket
    isConnected(): boolean;
    getIP(): string;
    getCert(): any;
    disconnect(): void;
    send(name: string, ...args: any[]): void;
}
