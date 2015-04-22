/// <reference path='../typings/tsd.d.ts' />

import restify = require('restify');
import bunyan = require('bunyan');
import BAPI = require('blpapi');

export interface IBufferedData<T> {
    buffer: T[];
    overflow: number;
}

export interface IHistoricalBufferManager<T> {
    pushValue(data: T): void;
    startNewBuffer(bufferLength?: number): IBufferedData<T>;
    getBuffer(depth?: number): IBufferedData<T>;
    isEmpty(depth?: number): boolean;
}

export interface ISubscription extends BAPI.Subscription {
    correlationId: number;
    buffer: IHistoricalBufferManager<Object>;
}

export interface IMap<T> {
    size: number;
    clear(): void;
    set(key: string|number, val: T): void;
    get(key: string|number): T;
    has(key: string|number): boolean;
    delete(key: string|number): void;
    keys(): string[];
    values(): T[];
    entries(): any[][];
    forEach(callbackFn: (val: T, key?: string, map?: IMap<T>) => boolean, thisArg?: any): void;
}

export interface IAPISession {
    inUse: number;
    lastPollId: number;
    lastSuccessPollId: number;
    seconds: number;
    expired: boolean;
    activeSubscriptions: IMap<ISubscription>;
    receivedSubscriptions: IMap<ISubscription>;
    expire(): boolean;
    renew(): void;
    isExpirable(): boolean;
}

export interface IOurRequest extends restify.Request {
    clientCert?: any;
    blpSession: BAPI.Session;
    apiSession?: IAPISession;
    identity?: BAPI.IIdentity;
}

export interface IOurResponse extends restify.Response {
    sendChunk?: (data: any) => void;
    sendOtherProp?: (properties: { [index: string]: any; }) => void;
    sendEnd?: (status: number, message: string) => void;
    sendWhole?: (status: number,
                 message: string,
                 properties?: { [index: string]: any; },
                 data?: any) => void;
    sendError?: (err: Error) => any;
}

export interface ISocket extends NodeJS.EventEmitter {
    // PROPERTIES
    log: bunyan.Logger; // Add bunyan logger to socket
    blpSession: BAPI.Session;  // Add blpSession to socket

    // MANIPULATORS
    sendData(correlationId: number, data: any): void;
    sendError(message: string): void;
    notifyConnected(): void;
    notifySubscribed(correlationIds: number[]): void;
    notifyUnsubscribed(correlationIds: number[]): void;
    disconnect(): void;

    // ACCESSORS
    isConnected(): boolean;
    getIP(): string;
    getCert(): any;
}
