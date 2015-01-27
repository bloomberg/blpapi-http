/// <reference path='../typings/tsd.d.ts' />

import restify = require('restify');
import bunyan = require('bunyan');
import BAPI = require('./blpapi-wrapper');

export interface IOurRequest extends restify.Request {
    clientCert?: any;
    blpSession: BAPI.Session;
}

export interface IOurResponse extends restify.Response {
    sendChunk?: (data: any) => Promise<void>;
    sendEnd?: (status: any, message: string) => Promise<void>;
    sendError?: (err: any, where: string, reason?: any) => Promise<void>;
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
