/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import events = require('events');
import util = require('util');
import Promise = require('bluebird');
import _ = require('lodash');
import blpapi = require('blpapi');

// Re-export blpapi public interfaces
/* tslint:disable:interface-name */
export interface SessionOpts extends blpapi.SessionOpts {}
export interface Subscription extends blpapi.Subscription {}
export interface Identity extends blpapi.Identity {}
/* tslint:enable:interface-name */
export interface ISession extends blpapi.ISession {}

export interface IInstruction {
    start?: boolean;
    openService?: boolean;
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

    // PRIVATE MANIPULATORS
    private terminateSession(): void {
        this.emit('SessionTerminated', { data: 'Session Terminated.' });
    }

    private sendSessionStarted(): void {
        this.emit('SessionStarted', { data: 'Session Started.' });
    }

    private sendSessionStartupFailure(): void {
        this.emit('SessionStartupFailure', {
            data: {
                reason: { description:  'Session Fail to Start.' }
            }
        });
    }

    private sendServiceOpened(cid: number): void {
        this.emit('ServiceOpened', {
            correlations: [ { value: cid } ]
        });
    }

    private sendServiceOpenFailure(uri: string, cid: number): void {
        this.emit('ServiceOpenFailure', {
            data: {
                reason: { description:  uri + ' Service Fail to Open.' }
            },
            correlations: [ { value: cid } ]
        });
    }

    private sendPartialRequestData(responseName: string, cid: number): void {
        this.emit(responseName, {
            eventType: 'PARTIAL_RESPONSE',
            messageType: responseName,
            correlations: [ { value: cid } ],
            data: 'TestData'
        });
    }

    private sendFinalRequestData(responseName: string, cid: number): void {
        this.emit(responseName, {
            eventType: 'RESPONSE',
            messageType: responseName,
            correlations: [ { value: cid } ],
            data: 'FinalTestData'
        });
    }

    private sendSubscriptionData(eventName: string, cid: number): void {
        this.emit(eventName, {
            correlations: [ { value: cid } ],
            data: 'TestData'
        });
    }

    // Error throwing must be synchronous
    private throwError(): void {
        throw new Error('TestError');
    }

    // CREATORS
    constructor (args: SessionOpts) {
        super();

        ipc.on('terminate-session', (): void => {
            this.terminateSession();
        });
    }

    // MANIPULATORS
    start(): Session {
        // If has preset instructions, follow it
        if (_.has(instructions, 'start')) {
            process.nextTick((): void => {
                if (instructions.start) {
                    this.sendSessionStarted();
                } else {
                    this.sendSessionStartupFailure();
                }
            });
        } else {    // Otherwise, wait for instruction
            ipc.emit('wait-to-start');
            ipc.on('start-success', (): void => {
                this.sendSessionStarted();
            });
            ipc.on('start-fail', (): void => {
                this.sendSessionStartupFailure();
            });
        }
        return this;
    }

    authorize(uri: string, cid: number): number {
        throw new Error('Not yet implemented');
    }

    authorizeUser(request: any, cid: number): number {
        throw new Error('Not yet implemented');
    }

    stop(): Session {
        throw new Error('Not yet implemented');
    }

    // Don't see a test case for this function yet
    destroy(): Session {
        return this;
    }

    openService(uri: string, cid: number): number {
        // If has preset instructions, follow it
        if (_.has(instructions, 'openService')) {
            process.nextTick((): void => {
                if (instructions.openService) {
                    this.sendServiceOpened(cid);
                } else {
                    this.sendServiceOpenFailure(uri, cid);
                }
            });
        } else {    // Otherwise, wait for instruction
            ipc.emit('wait-to-openService', {
                'uri': uri,
                'cid': cid
            });
            ipc.on(util.format('openService-%d-success', cid), (): void => {
                this.sendServiceOpened(cid);
            });
            ipc.on(util.format('openService-%d-fail', cid), (): void => {
                this.sendServiceOpenFailure(uri, cid);
            });
        }
        return cid;
    }

    subscribe(subs: Subscription[], identity?: Identity, label?: string): Session {
        // For subscribe, only communicate via ipc is supported
        ipc.emit('wait-to-subscribe', subs);
        _.forEach(subs, (sub: Subscription): void => {
            var serviceUri = getServiceForSecurity(sub.security);
            assert(SERVICE_TO_SUBSCRIPTION_EVENTS_MAP[serviceUri],
                   'Invalid service name.');
            var events: string[] = SERVICE_TO_SUBSCRIPTION_EVENTS_MAP[serviceUri];
            _.forEach(events, (e: string): void => {
                ipc.on(util.format('subscription-%d-%s', sub.correlation, e), (): void => {
                    this.sendSubscriptionData(e, sub.correlation);
                });
            });
        });
        return this;
    }

    resubscribe(subs: Subscription[], label?: string): Session {
        throw new Error('Not yet implemented');
    }
    unsubscribe(subs: Subscription[]): Session {
        // As long as we no longer send data event via ipc for unsubscribed cids, no-ops
        return this;
    }
    request(uri: string,
            name: string,
            request: any,
            cid: number,
            identity?: Identity,
            label?: string): number
    {
        assert(REQUEST_TO_RESPONSE_MAP[name], 'Invalid request name.');
        var responseName = REQUEST_TO_RESPONSE_MAP[name];
        // If has preset instructions, follow it
        if (_.has(instructions, 'request')) {
            // throw immediately if the first instruction is throwError
            if ('throwError' === instructions.request[0]) {
                this.throwError();
            } else {
                Promise.each(instructions.request,
                             (s: string, i: number, length: number): boolean => {
                    assert('sendPartialRequestData' === s || 'sendFinalRequestData' === s,
                           'Invalid operation ' + s);
                    this[s].call(this, responseName, cid);
                    return true;
                });
            }
        } else {    // Otherwise, wait for instruction(not working for throwError)
            ipc.emit('wait-to-request', {
                'uri': uri,
                'name': name,
                'request': request,
                'cid': cid
            });
            ipc.on(util.format('request-%d-partial', cid), (): void => {
                this.sendPartialRequestData(responseName, cid);
            });
            ipc.on(util.format('request-%d-final', cid), (): void => {
                this.sendFinalRequestData(responseName, cid);
            });
        }
        return cid;
    }
}
