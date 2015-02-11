/// <reference path='../typings/tsd.d.ts' />
'use strict';

import assert = require('assert');
import events = require('events');
import util = require('util');

import blpapi = require('blpapi');
import Promise = require('bluebird');
import debug = require('debug');
import _ = require('lodash');

// LOGGING
var trace = debug('blpapi-wrapper:trace');
var log = debug('blpapi-wrapper:debug');

// PUBLIC TYPES
export interface IRequestCallback {
    (err: Error, data?: any, isFinal?: boolean): void;
}

export class Subscription extends events.EventEmitter {
    security: string;
    fields: string[];
    options: any = null;

    constructor(security: string, fields: string[], options?: any) {
        super();

        this.security = security;
        this.fields = fields;
        if (3 === arguments.length) {
            this.options = options;
        }
    }

    private toJSON(): Object {
        var result: { security: string; fields: string[]; options?: any; } = {
            security: this.security,
            fields: this.fields
        };

        if (null !== this.options) {
            result.options = this.options;
        }

        return result;
    }
}

export class BlpApiError implements Error {
    // STATIC DATA
    static NAME: string = 'BlpApiErorr';

    // DATA
    data: any;
    name: string;
    message: string;
    constructor(data: any) {
        this.data = data;
        this.name = BlpApiError.NAME;
        this.message = data.reason.description;
    }
}

// CONSTANTS
var EVENT_TYPE = {
    RESPONSE:         'RESPONSE'
  , PARTIAL_RESPONSE: 'PARTIAL_RESPONSE'
};

// ANONYMOUS FUNCTIONS
function isObjectEmpty(obj: Object): boolean {
    return (0 === Object.getOwnPropertyNames(obj).length);
}

function reqName2RespName(name: string): string {
    return name.replace(/^Field\w+/, 'field') + 'Response';
}

function subscriptionsToServices(subscriptions: Subscription[]): string[] {
    return _(subscriptions).map((subscription: Subscription): string => {
        var serviceRegex = /^\/\/blp\/[a-z]+/;
        var match = serviceRegex.exec(subscription.security);
        // XXX: note that we shoud probably capture what the default service is to use when
        //      reading in the session options.  However, when not specified, it is
        //      '//blp/mktdata'.
        return match ? match[0] : '//blp/mktdata';
    }).uniq().valueOf();
}

export class Session extends events.EventEmitter {
    //ATTRIBUTES
    // TypeScript compiler needs this to allow "this['property-string']" type of access
    [index: string]: any;

    // DATA
    private session: blpapi.Session;
    private eventListeners: {[index: string]: {[index: number]: Function}} = {};
    private requests: {[index: string]: IRequestCallback} = {};
    private subscriptions: {[index: string]: Subscription} = {};
    private services: {[index: string]: Promise<void>} = {};
    private correlatorId: number = 0;
    private stopped: Promise<void> = null;

    // PRIVATE MANIPULATORS
    private nextCorrelatorId(): number {
        return this.correlatorId++;
    }

    private listen(eventName: string, expectedId: number, handler: Function): void {
        if (!(eventName in this.eventListeners)) {
            trace('Listener added: ' + eventName);
            this.session.on(eventName, ((eventName: string, m: any): void => {
                var correlatorId = m.correlations[0].value;
                assert(correlatorId in this.eventListeners[eventName],
                       'correlation id does not exist: ' + correlatorId);
                this.eventListeners[eventName][correlatorId](m);
            }).bind(this, eventName));

            this.eventListeners[eventName] = {};
        }
        this.eventListeners[eventName][expectedId] = handler;
    }

    private unlisten(eventName: string, correlatorId: number): void {
        delete this.eventListeners[eventName][correlatorId];
        if (isObjectEmpty(this.eventListeners[eventName])) {
            trace('Listener removed: ' + eventName);
            this.session.removeAllListeners(eventName);
            delete this.eventListeners[eventName];
        }
    }

    private openService(uri: string): Promise<void> {
        var thenable = this.services[uri] = this.services[uri] ||
                                            new Promise<void>((resolve: Function,
                                                               reject: Function): void => {
            trace('Opening service: ' + uri);
            var openServiceId = this.nextCorrelatorId();

            this.session.openService(uri, openServiceId);

            this.listen('ServiceOpened', openServiceId, (ev: any): void => {
                log('Service opened: ' + uri);
                trace(ev);
                this.unlisten('ServiceOpened', openServiceId);
                this.unlisten('ServiceOpenFailure', openServiceId);
                resolve();
            });

            this.listen('ServiceOpenFailure', openServiceId, (ev: any): void => {
                log('Service open failure' + uri);
                trace(ev);
                this.unlisten('ServiceOpened', openServiceId);
                this.unlisten('ServiceOpenFailure', openServiceId);
                delete this.services[uri];
                reject(new BlpApiError(ev.data));
            });
        }).bind(this); // end 'new Promise'

        return thenable;
    }

    private requestHandler(cb: IRequestCallback, m: any): void {
        var eventType = m.eventType;
        var isFinal = (EVENT_TYPE.RESPONSE === eventType);

        log(util.format('Response: %s|%d|%s',
                        m.messageType,
                        m.correlations[0].value,
                        eventType));
        trace(m);

        cb(null, m.data, isFinal);

        if (isFinal) {
            var correlatorId = m.correlations[0].value;
            var messageType = m.messageType;
            delete this.requests[correlatorId];
            this.unlisten(messageType, correlatorId);
        }
    }

    private sessionTerminatedHandler(ev: any): void {
        log('Session terminating');
        trace(ev);

        _([{prop: 'eventListeners', cleanupFn: (eventName: string): void => {
            this.session.removeAllListeners(eventName);
         }},
         {prop: 'requests', cleanupFn: (k: string): void => {
            this.requests[k](new Error('session terminated'));
         }},
         {prop: 'subscriptions', cleanupFn: (k: string): void => {
            this.subscriptions[k].emit('error', new Error('session terminated'));
         }}
       ]).forEach((table: {prop: string; cleanupFn: (s: string) => void}): void => {
            Object.getOwnPropertyNames(this[table.prop]).forEach((key: string): void => {
                table.cleanupFn(key);
            });
            this[table.prop] = null;
        });

        if (!this.stopped) {
            this.stopped = Promise.resolve();
        }

        // tear down the session
        this.session.destroy();
        this.session = null;

        // emit event to any listeners
        this.emit('SessionTerminated', ev.data);
        log('Session terminated');
    }

    // PRIVATE ACCESSORS
    private validateSession(): void {
        if (this.stopped) {
            throw new Error('session terminated');
        }
    }

    // CREATORS
    constructor(opts: blpapi.SessionOpts) {
        super();

        this.session = new blpapi.Session(opts);
        this.session.once('SessionTerminated', this.sessionTerminatedHandler.bind(this));
        log('Session created');
        trace(opts);
    }

    // MANIPULATORS
    start(cb?: (err: any, value: any) => void): Promise<void> {
        this.validateSession();

        return new Promise<void>((resolve: Function, reject: Function): void => {
            trace('Starting session');
            this.session.start();

            var listener = (listenerName: string, handler: Function, ev: any): void => {
                this.session.removeAllListeners(listenerName);
                handler(ev.data);
            };

            this.session.once('SessionStarted',
                              listener.bind(this, 'SessionStartupFailure', (data: any): void => {
                                  log('Session started');
                                  trace(data);
                                  resolve();
                              }));

            this.session.once('SessionStartupFailure',
                              listener.bind(this, 'SessionStarted', (data: any): void => {
                                  log('Session start failure');
                                  trace(data);
                                  reject(new BlpApiError(data));
                              }));
        }).nodeify(cb);
    }

    stop(cb?: (err: any, value: any) => void): Promise<void> {
        return this.stopped = this.stopped ||
                              new Promise<void>((resolve: Function, reject: Function): void => {
            log('Stopping session');
            this.session.stop();
            this.session.once('SessionTerminated', (ev: any): void => {
                resolve();
            });
        }).nodeify(cb);
    }

    request(uri: string, name: string, request: any, callback: IRequestCallback): void {
        this.validateSession();

        var correlatorId = this.nextCorrelatorId();
        this.requests[correlatorId] = callback;

        this.openService(uri).then((): void => {
            var responseEventName = reqName2RespName(name);
            var requestName = name + 'Request';
            log(util.format('Request: %s|%d', requestName, correlatorId));
            trace(request);
            this.session.request(uri, requestName, request, correlatorId);
            this.listen(responseEventName,
                        correlatorId,
                        this.requestHandler.bind(this, callback));
        }).catch((ex: Error): void => {
            delete this.requests[correlatorId];
            callback(ex);
        });
    }

    subscribe(subscriptions: Subscription[], cb?: (err: any) => void): Promise<void> {
        this.validateSession();

        _.forEach(subscriptions, (s: Subscription, i: number): void => {
            // XXX: O(N) - not critical but note to use ES6 Map in the future
            var cid = _.findKey(this.subscriptions, (other: Subscription): boolean => {
                return s === other;
            });

            if (undefined !== cid) {
                throw new Error('Subscription already exists for index ' + i);
            }
        });

        return Promise.all(_.map(subscriptionsToServices(subscriptions),
                                 (uri: string): Promise<void> =>
        {
            return this.openService(uri);
        })).then((): void => {
            log('Subscribing to: ' + JSON.stringify(subscriptions));

            this.session.subscribe(_.map(subscriptions, (s: Subscription): blpapi.Subscription => {
                var cid = this.nextCorrelatorId();

                // XXX: yes, this is a side-effect of map, but it is needed for performance reasons
                //      until ES6 Map is available
                this.subscriptions[cid] = s;
                this.listen('MarketDataEvents', cid, (m: any): void => {
                    s.emit('data', m.data, s);
                });

                var result: blpapi.Subscription = {
                    security: s.security,
                    correlation: cid,
                    fields: s.fields
                };

                if ('options' in s) {
                    result.options = s.options;
                }
                return result;
            }));
        }).nodeify(cb);
    }

    unsubscribe(subscriptions: Subscription[]): void {
        this.validateSession();

        log('Unsubscribing: ' + JSON.stringify(subscriptions));

        var cids: number[] = [];
        _.forEach(subscriptions, (s: Subscription, i: number): void => {
            // XXX: O(N) - not critical but note to use ES6 Map in the future
            var cid = _.findKey(this.subscriptions, (other: Subscription): boolean => {
                return s === other;
            });

            if (undefined === cid) {
                throw new Error('Subscription not found at index ' + i);
            } else {
                cids.push(_.parseInt(cid));
            }
        });

        this.session.unsubscribe(_(cids).forEach((cid: number): void => {
            process.nextTick((): void => {
                this.subscriptions[cid].emit('end');
                delete this.subscriptions[cid];
            });
            this.unlisten('MarketDataEvents', cid);
        }).map((cid: number): blpapi.Subscription => {
            return <blpapi.Subscription>{
                security: ' ',
                correlation: cid,
                fields: []
            };
        }).valueOf());
    }
}


