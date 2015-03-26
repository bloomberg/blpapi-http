/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import events = require('events');
import util = require('util');
import Promise = require('bluebird');
import _ = require('lodash');
import blpapi = require('blpapi');

// Re-export blpapi public interfaces
/* tslint:disable:interface-name */
export interface ISessionOpts extends blpapi.ISessionOpts {}
export interface IIdentity extends blpapi.IIdentity {}
export interface IRequestCallback extends blpapi.IRequestCallback {}
export interface ISession extends blpapi.ISession {}
export class Subscription extends blpapi.Subscription {}
export class BlpApiError extends blpapi.BlpApiError {}
/* tslint:enable:interface-name */


export interface IInstruction {
    start?: boolean;
    stop?: boolean;
    request?: string[];

    [index: string]: any;
}

// ipc channel through websocket
export var ipc: SocketIO.Socket;
export var instructions: IInstruction = {};

// Mapping of request types to response names to listen for.
// The strings are taken from section A of the BLPAPI Developer's Guide, and are organized by
// service.
// TODO: Move the const mapping into a separate file that could be shared with blpapi-wrapper
var REQUEST_TO_RESPONSE_MAP: { [index: string]: string; } = {
    // //blp/refdata
    'HistoricalDataRequest': 'HistoricalDataResponse',
    'IntraDayTickRequest':   'IntraDayTickResponse',
    'IntraDayBarRequest':    'IntraDayBarResponse',
    'ReferenceDataRequest':  'ReferenceDataResponse',
    'PortfolioDataRequest':  'PortfolioDataResponse',
    'BeqsRequest':           'BeqsResponse',

    // //blp/apiflds
    'FieldInfoRequest':              'fieldResponse',
    'FieldSearchRequest':            'fieldResponse',
    'CategorizedFieldSearchRequest': 'categorizedFieldResponse',

    // //blp/instruments
    'instrumentListRequest': 'InstrumentListResponse',
    'curveListRequest':      'CurveListResponse',
    'govtListRequest':       'GovtListResponse',

    // //blp/tasvc
    'studyRequest':          'studyResponse'
};

// Mapping of service URIs to the event names to listen to when subscribed to these services.
// TODO: Move the const mapping into a separate file that could be shared with blpapi-wrapper
var SERVICE_TO_SUBSCRIPTION_EVENTS_MAP: { [uri: string]: string[]; } = {
    '//blp/mktdata':  ['MarketDataEvents'],
    '//blp/mktvwap':  ['MarketDataEvents'],
    '//blp/mktbar':   ['MarketBarStart', 'MarketBarUpdate', 'MarketBarEnd'],
    '//blp/pagedata': ['PageUpdate']
};

// TODO: Move this function into a separate file that could be shared with blpapi-wrapper
function getServiceForSecurity(security: string): string
{
    var serviceRegex = /^\/\/blp\/[a-z]+/;
    var match = serviceRegex.exec(security);
    // XXX: note that we shoud probably capture what the default service is to use when
    //      reading in the session options.  However, when not specified, it is
    //      '//blp/mktdata'.
    return match ? match[0] : '//blp/mktdata';
}

// Mock Session object
export class Session extends events.EventEmitter implements ISession {
    // TypeScript compiler needs this to allow "this['property-string']" type of access
    [index: string]: any;

    private correlatorId: number = 0;

    // PRIVATE MANIPULATORS

    private nextCorrelatorId(): number {
        return this.correlatorId++;
    }

    private terminateSession(): void {
        this.emit('SessionTerminated', { data: 'Session Terminated.' });
    }

    private sendSessionStarted(cb: Function): void {
        cb();
    }

    private sendSessionStartupFailure(cb: Function): void {
        cb(new BlpApiError(
            {
                reason: {
                    description:  'Session Failed to Start.'
                }
            }));
    }

    private sendPartialRequestData(responseName: string,
                                   callback: IRequestCallback, cid: number): void {
        callback(null,
                 'TestData',
                 false);
    }

    private sendFinalRequestData(responseName: string,
                                 callback: IRequestCallback, cid: number): void {
        callback(null,
                 'FinalTestData',
                 true);
    }

    private sendSubscriptionData(eventName: string, sub: Subscription): void {
        sub.emit('data', 'TestData');
    }

    // CREATORS
    constructor(opts: ISessionOpts) {
        super();
        ipc.on('terminate-session', (): void => {
            this.terminateSession();
        });
    }

    // MANIPULATORS
    start(cb?: (err: any, value: any) => void): Promise<void> {
        return new Promise<void>((resolve: Function, reject: Function): void => {
            // If has preset instructions, follow it
            if (_.has(instructions, 'start')) {
                if (instructions.start) {
                    this.sendSessionStarted(resolve);
                } else {
                    this.sendSessionStartupFailure(reject);
                }
            } else {    // Otherwise, wait for instruction
                ipc.emit('wait-to-start');
                ipc.on('start-success', (): void => {
                    this.sendSessionStarted(resolve);
                });
                ipc.on('start-fail', (): void => {
                    this.sendSessionStartupFailure(reject);
                });
            }
        });
    }

    authenticate(cb?: (err: any, value: any) => void): Promise<string> {
        throw new Error('Not yet implemented');
    }

    authorize(token: string, cb?: (err: any, value: any) => void): Promise<IIdentity> {
        throw new Error('Not yet implemented');
    }

    stop(cb?: (err: any, value: any) => void): Promise<void> {
        return new Promise<void>((resolve: Function, reject: Function): void => {
            this.terminateSession();
            resolve();
        }).nodeify(cb);
    }

    subscribe(subs: Subscription[],
              cb?: (err: any) => void): Promise<void>;

    subscribe(subs: Subscription[],
              identity: IIdentity,
              cb?: (err: any) => void): Promise<void>;

    subscribe(subs: Subscription[],
              label: string,
              cb?: (err: any) => void): Promise<void>;

    subscribe(subs: Subscription[],
              identity: IIdentity,
              label: string,
              cb?: (err: any) => void): Promise<void>;

    subscribe(subs: Subscription[],
              arg1?: IIdentity | string | ((err: any) => void),
              arg2?: string | ((err: any) => void),
              arg3?: (err: any) => void): Promise<void>
    {
        var cb: (err: any) => void = undefined;
        if (typeof arguments[arguments.length - 1] === 'function') {
           cb = arguments[arguments.length - 1];
        }
        return new Promise<void>((resolve: Function, reject: Function): void => {
            // For subscribe, only communicate via ipc is supported
            ipc.emit('wait-to-subscribe', subs);

            var hasInvalidServiceUri = subs.some((sub: Subscription): boolean => {
                var serviceUri = getServiceForSecurity(sub.security);
                if (!SERVICE_TO_SUBSCRIPTION_EVENTS_MAP[serviceUri]) {
                    return true;
                }
                return false;
            });
            if (hasInvalidServiceUri) {
                reject(new Error('Invalid service name'));
                return;
            }
            subs.forEach((sub: Subscription): void => {
                var cid = _.findKey(subs, (other: Subscription): boolean => {
                    return sub === other;
                });
                var serviceUri = getServiceForSecurity(sub.security);
                var events: string[] = SERVICE_TO_SUBSCRIPTION_EVENTS_MAP[serviceUri];
                _.forEach(events, (e: string): void => {
                    ipc.on(util.format('subscription-%s', e), (): void => {
                        this.sendSubscriptionData(e, sub);
                    });
                });
            });
            resolve();
        }).nodeify(cb);
    }

    unsubscribe(subs: Subscription[]): void {
        // As long as we no longer send data event via ipc for unsubscribed cids, no-ops
        ipc.emit('wait-to-unsubscribe', subs);
    }

    request(uri: string,
            name: string,
            request: any,
            callback: IRequestCallback): void;

    request(uri: string,
            name: string,
            request: any,
            identity: IIdentity,
            callback: IRequestCallback): void;

    request(uri: string,
            name: string,
            request: any,
            label: string,
            callback: IRequestCallback): void;

    request(uri: string,
            name: string,
            request: any,
            identity: IIdentity,
            label: string,
            callback: IRequestCallback): void;

    request(uri: string,
            name: string,
            request: any,
            arg3: Object | string | IRequestCallback,
            arg4?: string | IRequestCallback,
            arg5?: IRequestCallback): void
    {
        var callback = Array.prototype.slice.call(arguments, -1)[0];
        assert(typeof callback === 'function');

        var responseName = REQUEST_TO_RESPONSE_MAP[name];
        if (!responseName) {
            callback(new BlpApiError(
                { reason: { description:  'Session Failed to Start.' } }));
        }
        var cid = this.nextCorrelatorId();

        // If has preset instructions, follow it
        if (_.has(instructions, 'request')) {
            // Generate error if requested.
            if ('generateError' === instructions.request[0]) {
                callback(new BlpApiError(
                    { reason: { description:  'Error requested.' } }));
            } else {
                Promise.each(instructions.request,
                             (s: string, i: number, length: number): boolean => {
                    assert('sendPartialRequestData' === s || 'sendFinalRequestData' === s,
                           'Invalid operation ' + s);
                    this[s].call(this, responseName, cid);
                    return true;
                });
            }
        } else {    // Otherwise, wait for instruction(not working for generateError)
            ipc.on('terminate-session', (): void => {
                callback(new Error('session terminated'));
            });
            ipc.emit('wait-to-request', {
                'uri': uri,
                'name': name,
                'request': request,
                'cid': cid
            });
            ipc.on(util.format('request-%d-partial', cid), (): void => {
                this.sendPartialRequestData(responseName, callback, cid);
            });
            ipc.on(util.format('request-%d-final', cid), (): void => {
                this.sendFinalRequestData(responseName, callback, cid);
            });
        }
    }
}
