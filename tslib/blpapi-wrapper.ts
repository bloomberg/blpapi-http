/// <reference path="../typings/tsd.d.ts" />
'use strict';

import assert = require('assert');
import events = require('events');
import util = require('util');

import blpapi = require('blpapi');
import Promise = require('bluebird');
import debug = require('debug');

// LOGGING
var trace = debug('blpapi-wrapper:trace');
var log = debug('blpapi-wrapper:debug');

// TYPES
export interface RequestCallback {
    (err: Error, data?: any, isFinal?: boolean): void;
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

// ANONYMOUS FUNCTION
function isObjectEmpty(obj: Object) {
    return (0 === Object.getOwnPropertyNames(obj).length);
}

export class Session extends events.EventEmitter {
    //ATTRIBUTES
    // TypeScript compiler needs this to allow "this['property-string']" type of access
    [index: string]: any;

    // DATA
    private session: blpapi.Session;
    private eventListeners: {[index: string]: {[index: number]: Function}} = {};
    private requests: {[index: string]: RequestCallback} = {};
    private services: {[index: string]: Promise<void>} = {};
    private correlatorId: number = 0;
    private stopped: Promise<void> = null;

    // PRIVATE MANIPULATORS
    private nextCorrelatorId(): number {
        return this.correlatorId++;
    }

    private listen(eventName: string, expectedId: number, handler: Function) {
        if (!(eventName in this.eventListeners)) {
            trace('Listener added: ' + eventName);
            this.session.on(eventName, ((eventName: string, m: any) => {
                var correlatorId = m.correlations[0].value;
                assert(correlatorId in this.eventListeners[eventName],
                       'correlation id does not exist: ' + correlatorId);
                this.eventListeners[eventName][correlatorId](m);
            }).bind(this, eventName));

            this.eventListeners[eventName] = {};
        }
        this.eventListeners[eventName][expectedId] = handler;
    }

    private unlisten(eventName: string, correlatorId: number) {
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
                                                               reject: Function) => {
            trace('Opening service: ' + uri);
            var openServiceId = this.nextCorrelatorId();

            this.session.openService(uri, openServiceId);

            this.listen('ServiceOpened', openServiceId, (ev: any) => {
                log('Service opened: ' + uri);
                trace(ev);
                this.unlisten('ServiceOpened', openServiceId);
                this.unlisten('ServiceOpenFailure', openServiceId);
                resolve();
            });

            this.listen('ServiceOpenFailure', openServiceId, (ev: any) => {
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

    private requestHandler(cb: RequestCallback, m: any) {
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

    private sessionTerminatedHandler(ev: any) {
        log('Session terminating');
        trace(ev);

        [{prop: 'eventListeners', cleanupFn: (eventName: string) => {
            this.session.removeAllListeners(eventName);
         }},
         {prop: 'requests', cleanupFn: (k: string) => {
            this.requests[k](new Error('session terminated'));
         }}
        ].forEach((table) => {
            Object.getOwnPropertyNames(this[table.prop]).forEach((key) => {
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
    private validateSession() {
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

        return new Promise<void>((resolve: Function, reject: Function) => {
            trace('Starting session');
            this.session.start();

            var listener = (listenerName: string, handler: Function, ev: any) => {
                this.session.removeAllListeners(listenerName);
                handler(ev.data);
            };

            this.session.once('SessionStarted',
                              listener.bind(this, 'SessionStartupFailure', (data: any) => {
                                  log('Session started');
                                  trace(data);
                                  resolve();
                              }));

            this.session.once('SessionStartupFailure',
                              listener.bind(this, 'SessionStarted', (data: any) => {
                                  log('Session start failure');
                                  trace(data);
                                  reject(new BlpApiError(data));
                              }));
        }).nodeify(cb);
    }

    stop(cb?: (err: any, value: any) => void): Promise<void> {
        return this.stopped = this.stopped ||
                              new Promise<void>((resolve: Function, reject: Function) => {
            log('Stopping session');
            this.session.stop();
            this.session.once('SessionTerminated', (ev: any) => {
                resolve();
            });
        }).nodeify(cb);
    }

    request(uri: string, name: string, request: any, callback: RequestCallback): void {
        this.validateSession();

        var correlatorId = this.nextCorrelatorId();
        this.requests[correlatorId] = callback;

        this.openService(uri).then(() => {
            var responseEventName = name + 'Response';
            var requestName = name + 'Request';
            log(util.format('Request: %s|%d', requestName, correlatorId));
            trace(request);
            this.session.request(uri, requestName, request, correlatorId);
            this.listen(responseEventName,
                        correlatorId,
                        this.requestHandler.bind(this, callback));
        }).catch(function(ex) {
            delete this.requests[correlatorId];
            callback(ex);
        });
    }
}

