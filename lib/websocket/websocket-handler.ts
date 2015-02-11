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
                socket.send('err', { message: 'Unexpected error: ' + err.message });
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
            socket.log.debug('blpSession terminated unexpectedly. Terminate socket.');
            socket.send('err', { message: 'blpSession terminated unexpectedly.' });
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
            socket.log.debug('No valid subscriptions found.');
            socket.send('err', { message: 'No valid subscriptions found.' });
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
                socket.log.debug('Invalid subscription option.');
                socket.send('err', { message: 'Invalid subscription option.' });
                return;
            }
            if (receivedSubscriptions.has(s.correlationId)) {
                socket.log.debug('Correlation Id already exists.');
                socket.send('err', { message: 'Correlation Id already exists.' });
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
                socket.send('data', {'correlationId': sub.correlationId,
                                     'data': data});
                socket.log.info('Data sent');
            });
        });

        // Subscribe user request through blpapi-wrapper
        socket.blpSession.subscribe(subscriptions)
            .then((): void => {
                if (socket.isConnected()) {
                    subscriptions.forEach((s: Subscription): void => {
                        activeSubscriptions.set(s.correlationId, s);
                    });
                    socket.log.debug('Subscribed');
                    socket.send('subscribed');
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
                    socket.send('err', err);
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
            socket.log.debug('No active subscriptions.');
            socket.send('err', { message: 'No active subscriptions.' });
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
                socket.log.debug('Invalid unsubscribe data received.');
                socket.send('err', { message: 'Invalid unsubscribe data received.' });
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
                    socket.log.debug('Invalid correlation Id ' + cid + ' received.');
                    socket.send('err', { message: 'Invalid correlation Id ' + cid + ' received.' });
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
            socket.log.error(ex, 'Error Unsubscribing');
            socket.send('err', { message: 'error unsubscribing:' + ex});
            return;
        }
        subscriptions.forEach((s: Subscription): void => {
            s.removeAllListeners();
            activeSubscriptions.delete(s.correlationId);
            receivedSubscriptions.delete(s.correlationId);
        });
        receivedSubscriptions.size
            ? socket.send('unsubscribed')
            : socket.send('unsubscribed all');
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
    socket.send('connected');
}
