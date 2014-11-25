/// <reference path="../typings/tsd.d.ts" />
'use strict';

import assert = require('assert');
import events = require('events');
import util = require ('util');

import blpapi = require('blpapi');
import Promise = require('bluebird');
import debug = require('debug');

// LOGGING
var trace = debug('blpapi-wrapper:trace');

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
    // DATA
    private session: blpapi.Session;
    // TODO: figure out how to declare object types
    private eventListeners: {[index: string]: any} = {};
    private requests: {[index: string]: RequestCallback} = {};
    private services: {[index: string]: Promise<void>} = {};
    private correlatorId: number = 0;
    private requestId: number = 0;

    // PRIVATE MANIPULATORS
    private listen(eventName: string, expectedId: number, handler: Function) {
        if (!(eventName in this.eventListeners)) {
            trace(util.format('\'%s\' listener added', eventName));
            this.session.on(eventName, (function(eventName: string, m: any) {
                trace(m);
                var correlatorId = m.correlations[0].value;
                this.eventListeners[eventName][correlatorId](m);
            }).bind(this, eventName));

            this.eventListeners[eventName] = {};
        }
        this.eventListeners[eventName][expectedId] = handler;
    }

    private unlisten(eventName: string, correlatorId: number) {
        delete this.eventListeners[eventName][correlatorId];
        if (isObjectEmpty(this.eventListeners[eventName])) {
            trace(util.format('\'%s\' listener removed ', eventName));
            this.session.removeAllListeners(eventName);
            delete this.eventListeners[eventName];
        }
    }

    private requestHandler(cb: RequestCallback, requestId: number, m: any) {
        var eventType = m.eventType;
        var isFinal = (EVENT_TYPE.RESPONSE === eventType);

        cb(null, m.data, isFinal);

        if (isFinal) {
            var correlatorId = m.correlations[0].value;
            var messageType = m.messageType;
            delete this.requests[requestId];
            this.unlisten(messageType, correlatorId);
        }
    }

    private sessionTerminatedHandler(ev: any) {
        trace(ev);

        // clean up listeners
        Object.getOwnPropertyNames(this.eventListeners).forEach((eventName) => {
            this.session.removeAllListeners(eventName);
        });
        this.eventListeners = {};

        // tear down the session
        this.session.destroy();
        this.session = null;

        // notify pending requests that the session has been terminated
        Object.getOwnPropertyNames(this.requests).forEach((key) => {
            this.requests[key](new Error('session terminated'));
        });
        this.requests = {};

        // emit event to any listeners
        this.emit('SessionTerminated', ev.data);
    }


    // CREATORS
    constructor(opts: blpapi.SessionOpts) {
        super();

        this.session = new blpapi.Session(opts);
        this.session.once('SessionTerminated', this.sessionTerminatedHandler.bind(this));
    }

    // MANIPULATORS
    start(cb?: (err: any, value: any) => void): Promise<void> {
        if (null === this.session) {
            throw new Error('session terminated');
        }

        return new Promise<void>((resolve, reject) => {
            this.session.start();

            var listener = (listenerName: string, handler: Function, ev: any) => {
                this.session.removeAllListeners(listenerName);
                handler(ev.data);
            };

            this.session.once('SessionStarted',
                              listener.bind(this, 'SessionStartupFailure', resolve));

            this.session.once('SessionStartupFailure',
                              listener.bind(this, 'SessionStarted', (data: any) => {
                                  reject(new BlpApiError(data));
                              }));
        }).nodeify(cb);
    }

    stop(cb?: (err: any, value: any) => void): Promise<void> {
        return (null === this.session) ? Promise.resolve()
                                       : new Promise<void>((resolve: Function,
                                                            reject: Function) => {
            this.session.stop();
            this.session.once('SessionTerminated', (ev: any) => {
                // TODO: must a promise when resolved produce a value?
                resolve();
            });
        }).nodeify(cb);
    }

    request(uri: string, name: string, request: any, callback: RequestCallback) : void {
        if (null === this.session) {
            return process.nextTick(callback.bind(null, new Error('session terminated')));
        }

        var requestId = this.requestId++;
        this.requests[requestId] = callback;

        var thenable = this.services[uri] = this.services[uri] ||
                                            new Promise<void>((resolve: Function,
                                                               reject: Function) => {
            var openServiceId = this.correlatorId++;

            this.session.openService(uri, openServiceId);

            this.listen('ServiceOpened', openServiceId, (ev: any) => {
                this.unlisten('ServiceOpened', openServiceId);
                this.unlisten('ServiceOpenFailure', openServiceId);
                resolve();
            });

            this.listen('ServiceOpenFailure', openServiceId, (ev: any) => {
                this.unlisten('ServiceOpened', openServiceId);
                this.unlisten('ServiceOpenFailure', openServiceId);
                delete this.services[uri];
                reject(new BlpApiError(ev.data));
            });
        }).bind(this); // end 'new Promise'

        thenable.then(() => {
            var responseEventName = name + 'Response';
            var correlatorId = this.correlatorId++;
            this.session.request(uri, name + 'Request', request, correlatorId);
            this.listen(responseEventName,
                        correlatorId,
                        this.requestHandler.bind(this, callback, requestId));
        }).catch(function(ex) {
            delete this.requests[requestId];
            callback(ex);
        });
    }
}

