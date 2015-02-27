/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import events = require('events');
import Promise = require('bluebird');
import _ = require('lodash');
import BAPI = require('../../lib/blpapi-wrapper');

export interface IInstruction {
    start?: boolean;    // Default behavior is to start session successfully
    stop?: boolean;     // Default behavior is to stop session successfully
    request: string[];
    subscribe?: string[];   // Not yet implemented
    unsubscribe?: string[]; // Not yet implemented
}

// Re-export BAPI public interfaces/classes
export interface ISession extends BAPI.ISession {}
export interface IRequestCallback extends BAPI.IRequestCallback {}
export class Subscription extends BAPI.Subscription {
    constructor(security: string, fields: string[], options?: any) {
        super(security, fields, options);
    }
}
export class BlpApiError extends BAPI.BlpApiError {
    constructor(data: any) {
        super(data);
    }
}

// Mock Session object that behave according to instructions
export class Session extends events.EventEmitter implements ISession {
    // TypeScript compiler needs this to allow "this['property-string']" type of access
    [index: string]: any;

    // DATA
    private instructions: IInstruction;

    // PRIVATE MANIPULATORS
    private terminateSession(): void {
        this.emit('SessionTerminated');
    }

    private sendPartialData(cb: BAPI.IRequestCallback): void {
        cb(null, 'TestData', false);
    }

    private sendFinalData(cb: BAPI.IRequestCallback): void {
        cb(null, 'FinalTestData', true);
    }

    private sendError(cb: BAPI.IRequestCallback): void {
        cb(new Error('TestError'));
    }

    // CREATORS
    constructor(opts: Object) {
        super();
        this.instructions = process.env.WRAPPER_INSTRUCTIONS ?
                            JSON.parse(process.env.WRAPPER_INSTRUCTIONS) :
                            {};  // Read instructions from env variable
    }

    // MANIPULATORS
    start(cb?: (err: any, value: any) => void): Promise<void> {
        return !_.has(this.instructions, 'start') || this.instructions.start ?
               Promise.resolve() :
               Promise.reject(new Error('Can not start blpsession'));
    }

    stop(cb?: (err: any, value: any) => void): Promise<void> {
        return !_.has(this.instructions, 'stop') || this.instructions.stop ?
               Promise.resolve() :
               Promise.reject(new Error('Can not stop blpsession'));
    }

    // Supported operations:
    // sendPartialData, sendFinalData, sendError, terminateSession
    request(uri: string, name: string, request: any, cb: BAPI.IRequestCallback): void {
        assert(this.instructions.request, 'No request instructions.');
        Promise.resolve(this.instructions.request)
            .each((s: string, i: number, length: number): boolean => {
                assert(this[s], 'Invalid operation ' + s);
                this[s].call(this, cb);
                return true;
            });
    }

    subscribe(subscriptions: BAPI.Subscription[], cb?: (err: any) => void): Promise<void> {
        throw new Error('Not yet implemented');
    }

    unsubscribe(subscriptions: BAPI.Subscription[]): void {
        throw new Error('Not yet implemented');
    }
}
