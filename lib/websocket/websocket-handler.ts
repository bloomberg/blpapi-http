/// <reference path='../../typings/tsd.d.ts' />

import _ = require('lodash');
import Promise = require('bluebird');
import bunyan = require('bunyan');
import uuid = require('node-uuid');
import SocketIO = require('socket.io');
import webSocket = require('ws');
import Subscription = require('../subscription/subscription');
import Map = require('../util/map');
import conf = require('../config');
import Interface = require('../interface');
import blpSession = require('../middleware/blp-session');
import SocketIOWrapper = require('./socket-io-wrapper');
import WSWrapper = require('./ws-wrapper');

// GLOBAL
var LOGGER: bunyan.Logger = bunyan.createLogger(conf.get('loggerOptions'));

// PUBLIC FUNCTIONS
export function sioOnConnect(s: SocketIO.Socket): void
{
    var socket: Interface.ISocket = new SocketIOWrapper(s, LOGGER.child({req_id: uuid.v4()}));
    onConnect(socket);
}

export function wsOnConnect(s: webSocket): void
{
    var socket: Interface.ISocket = new WSWrapper(s, LOGGER.child({req_id: uuid.v4()}));
    onConnect(socket);
}

// PRIVATE FUNCTIONS
function onConnect(socket: Interface.ISocket): void
{
    initialize(socket)
        .then(setup)
        .catch((err: Error): any => {
            socket.log.error(err);
            if (socket.isConnected()) {
                socket.sendError('Unexpected error: ' + err.message);
                socket.disconnect();
            }
        });
}

function initialize(socket: Interface.ISocket): Promise<Interface.ISocket>
{
    socket.log.info({Address: socket.getIP()}, 'Client connected.');
    if (conf.get('https.enable') && conf.get('logging.clientDetail')) {
        socket.log.debug({cert: socket.getCert()}, 'Client certificate.');
    }

    // Get blpSession
    return blpSession.getSocketSession(socket);
}

function setup(socket: Interface.ISocket): void
{
    // Create subscriptions store
    var activeSubscriptions = new Map<Subscription>();
    var receivedSubscriptions = new Map<Subscription>();

    // Clean up sockets for cases where the underlying session terminated unexpectedly
    socket.blpSession.once('SessionTerminated', (): void => {
        if (socket.isConnected()) {
            var message = 'blpSession terminated unexpectedly.';
            socket.log.debug(message);
            socket.sendError(message);
            socket.disconnect();
        }
    });

    // Subscribe
    socket.on('subscribe', (data: Object[]): void => {
        socket.log.info('Subscribe request received');
        // Log body if configured
        if (conf.get('logging.reqBody')) {
            socket.log.debug({body: data}, 'Subscribe body.');
        }

        // Validate input options
        var subscriptions: Subscription[] = [];
        if (!data.length) {
            var message = 'No valid subscriptions found.';
            socket.log.debug(message);
            socket.sendError(message);
            return;
        }
        data.forEach((s: {'correlationId': number;
                          'security': string;
                          'fields': string[];
                          'options'?: any }): void => {
            // Check if all requests are valid
            // The Subscribe request will proceed only if all subscriptions are valid
            if (!_.has(s, 'correlationId') ||
                !_.isNumber(s.correlationId) ||
                !_.has(s, 'security') ||
                !_.isString(s.security) ||
                !_.has(s, 'fields') ||
                !_.isArray(s.fields)) {

                var message = 'Invalid subscription option.';
                socket.log.debug(message);
                socket.sendError(message);
                return;
            }

            if (receivedSubscriptions.has(s.correlationId)) {
                message = 'Correlation id ' + s.correlationId + ' already exists.';
                socket.log.debug(message);
                socket.sendError(message);
                return;
            }

            var sub = new Subscription(s.correlationId,
                                       s.security,
                                       s.fields,
                                       s.options);
            subscriptions.push(sub);
            receivedSubscriptions.set(sub.correlationId, sub);

            // Add event listener for each subscription
            sub.on('data', (data: any): void => {
                socket.log.debug({data: {cid: sub.correlationId, time: process.hrtime()}},
                                 'Data received');

                // Emit the data
                // TODO: Acknowledgement callback function?
                socket.sendData(sub.correlationId, data);
                socket.log.info('Data sent');
            });

            // Must subscribe to the 'error' event; otherwise EventEmitter will throw an exception
            // that was occurring from the underlying blpapi.Session.  It is the assumed that the
            // blpapi.Session properly cleans up the subscription (i.e., 'unsubscribe()' should not
            // be called).
            sub.on('error', (err: Error): void => {
                socket.log.error(err, 'blpapi.Session subscription error occurred.');
                socket.sendError(err.message);
                sub.removeAllListeners();
                activeSubscriptions.delete(sub.correlationId);
                receivedSubscriptions.delete(sub.correlationId);
            });
        });

        // Subscribe user request through blpapi-wrapper
        // TODO: Support authorized identity.
        socket.blpSession.subscribe(subscriptions, undefined)
            .then((): void => {
                if (socket.isConnected()) {
                    subscriptions.forEach((s: Subscription): void => {
                        activeSubscriptions.set(s.correlationId, s);
                    });
                    socket.log.debug('Subscribed');
                    socket.notifySubscribed();
                } else { // Unsubscribe if socket already closed
                    try {
                        socket.blpSession.unsubscribe(subscriptions);
                    } catch (ex) {
                        socket.log.error(ex, 'Error Unsubscribing');
                    }
                    subscriptions.forEach((s: Subscription): void => {
                        s.removeAllListeners();
                        receivedSubscriptions.delete(s.correlationId);
                    });
                    socket.log.debug('Unsubscribed all active subscriptions');
                }
            }).catch( (err: Error): void => {
                socket.log.error(err, 'Error Subscribing');
                subscriptions.forEach((s: Subscription): void => {
                    s.removeAllListeners();
                    receivedSubscriptions.delete(s.correlationId);
                });
                if (socket.isConnected()) {
                    socket.sendError(err.message);
                }
            });
    });

    // Unsubscribe
    socket.on('unsubscribe', (data: { 'correlationIds': number[] }): void => {
        socket.log.info('Unsubscribe request received');
        // Log body if configured
        if (conf.get('logging.reqBody')) {
            socket.log.debug({body: data}, 'Unsubscribe body.');
        }

        if (!activeSubscriptions.size) {
            var message = 'No active subscriptions';
            socket.log.debug(message);
            socket.sendError(message);
            return;
        }

        var subscriptions: Subscription[] = [];

        if (!data) {
            // If no correlation Id specified
            // the default behavior is to unsubscribe all active subscriptions
            subscriptions = activeSubscriptions.values();
        } else {
            // If we do receive data object, first check if it is valid(empty list is INVALID)
            if (!_.has(data, 'correlationIds') ||
                !_.isArray(data.correlationIds) ||
                !data.correlationIds.length) {
                message = 'Invalid unsubscribe data received.';
                socket.log.debug(message);
                socket.sendError(message);
                return;
            }
            // Next, validate all correlation Ids
            // Will error if any invalid correlation Id received
            var isAllValid = true;
            _.uniq(data.correlationIds).forEach((cid: number): boolean => {
                if (activeSubscriptions.has(cid)) {
                    subscriptions.push(activeSubscriptions.get(cid));
                } else {
                    isAllValid = false;
                    var message = 'Invalid correlation Id ' + cid + ' received.';
                    socket.log.debug(message);
                    socket.sendError(message);
                    return false;
                }
            });
            if (!isAllValid) {
                return;
            }
        }

        try {
            socket.blpSession.unsubscribe(subscriptions);
        } catch (ex) {
            message = 'Error unsubscribing';
            socket.log.error(message);
            socket.sendError(message);
            return;
        }
        subscriptions.forEach((s: Subscription): void => {
            s.removeAllListeners();
            activeSubscriptions.delete(s.correlationId);
            receivedSubscriptions.delete(s.correlationId);
        });
        socket.notifyUnsubscribed(0 === receivedSubscriptions.size);
        socket.log.debug({activeSubscriptions: activeSubscriptions.size}, 'Unsubscribed.');
    });

    // Disconnect
    socket.on('disconnect', (): void => {
        // Unsubscribe all active subscriptions
        if (activeSubscriptions.size) {
            var subscriptions: Subscription[] = activeSubscriptions.values();
            try {
                socket.blpSession.unsubscribe(subscriptions);
            } catch (ex) {
                socket.log.error(ex, 'Error Unsubscribing');
            }
            subscriptions.forEach((s: Subscription): void => {
                s.removeAllListeners();
                activeSubscriptions.delete(s.correlationId);
                receivedSubscriptions.delete(s.correlationId);
            });
            socket.log.debug('Unsubscribed all active subscriptions');
        }
        socket.log.info('Client disconnected.');
    });

    // Complete server setup
    socket.notifyConnected();
}
