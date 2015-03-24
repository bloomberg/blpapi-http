/// <reference path='../../typings/tsd.d.ts' />

import util = require('util');
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

// Type used for subscription input from request body
type SubscriptionOption = {
    correlationId: number;
    security: string;
    fields: string[];
    options?: any;
}

type ISubscription = Interface.ISubscription;

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
function getCorrelationIds(subscriptions: ISubscription[]): number[] {
    return subscriptions.map((s: ISubscription): number => {
        return s.correlationId;
    });
}

function onConnect(socket: Interface.ISocket): void
{
    socket.log.info({Address: socket.getIP()}, 'Client connected.');
    if (conf.get('https.enable') && conf.get('logging.clientDetail')) {
        socket.log.debug({cert: socket.getCert()}, 'Client certificate.');
    }

    // Get blpSession
    var blpSocketSession = blpSession.getSocketSession(socket)
        .catch((err: Error): any => {
            socket.log.error(err);
            if (socket.isConnected()) {
                socket.sendError('Unexpected error: ' + err.message);
                socket.disconnect();
            }
        });

    // Create subscriptions store
    var activeSubscriptions = new Map<ISubscription>();
    var receivedSubscriptions = new Map<ISubscription>();

    blpSocketSession.then((socket: Interface.ISocket): void => {
        // Clean up sockets for cases where the underlying session terminated unexpectedly
        socket.blpSession.once('SessionTerminated', (): void => {
            if (socket.isConnected()) {
                var message = 'blpSession terminated unexpectedly.';
                socket.log.debug(message);
                socket.sendError(message);
                socket.disconnect();
            }
        });
    });

    // Subscribe
    socket.on('subscribe', (data: Object[]): void => {
        socket.log.info('Subscribe request received');
        // Log body if configured
        if (conf.get('logging.reqBody')) {
            socket.log.debug({body: data}, 'Subscribe body.');
        }

        // Validate input options
        if (!data || !data.length) {
            var message = 'No valid subscriptions found.';
            socket.log.debug(message);
            socket.sendError(message);
            return;
        }
        var errMessage: string;
        var isValid: boolean = _.every(data, (s: SubscriptionOption): boolean => {
            if (!_.has(s, 'correlationId') ||
                !_.isNumber(s.correlationId) ||
                !_.has(s, 'security') ||
                !_.isString(s.security) ||
                !_.has(s, 'fields') ||
                !_.isArray(s.fields))
            {
                errMessage = 'Invalid subscription option.';
                return false;
            }
            if (receivedSubscriptions.has(s.correlationId)) {
                errMessage = util.format('Correlation Id %d already exist.', s.correlationId);
                return false;
            }
            return true;
        });
        if (!isValid) {
            socket.log.debug(errMessage);
            socket.sendError(errMessage);
            return;
        }
        if (data.length !== _(data).pluck('correlationId').uniq().value().length) {
            errMessage = 'Duplicate correlation Id received.';
            socket.log.debug(errMessage);
            socket.sendError(errMessage);
            return;
        }

        // Create Subscription object array and add event listeners
        var subscriptions = _.map(data, (s: SubscriptionOption): ISubscription => {
            var sub = new Subscription(s.correlationId,
                                       s.security,
                                       s.fields,
                                       s.options);

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
                remove(sub);
            });

            receivedSubscriptions.set(sub.correlationId, sub);
            return sub;
        });

        blpSocketSession.then((socket: Interface.ISocket): void => {
            // Subscribe user request through blpapi-wrapper
            // TODO: Support authorized identity.
            socket.blpSession.subscribe(subscriptions, undefined).then((): void => {
                if (socket.isConnected()) {
                    subscriptions.forEach((s: ISubscription): void => {
                        activeSubscriptions.set(s.correlationId, s);
                    });
                    socket.log.debug('Subscribed');
                    socket.notifySubscribed(getCorrelationIds(subscriptions));
                } else { // Unsubscribe if socket already closed
                    unsubscribe(subscriptions);
                }
            }).catch( (err: Error): void => {
                socket.log.error(err, 'Error Subscribing');
                subscriptions.forEach(remove);
                if (socket.isConnected()) {
                    socket.sendError(err.message);
                }
            });
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

        var subscriptions: ISubscription[] = [];

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
            var errMessage: string;
            var isAllValid = _.every(_.uniq(data.correlationIds), (cid: number): boolean => {
                if (activeSubscriptions.has(cid)) {
                    subscriptions.push(activeSubscriptions.get(cid));
                    return true;
                }

                errMessage = util.format('Invalid correlation Id %d received.', cid);
                return false;
            });
            if (!isAllValid) {
                socket.log.debug(errMessage);
                socket.sendError(errMessage);
                return;
            }
        }
        unsubscribe(subscriptions, true /* notify */);
    });

    // Disconnect
    socket.on('disconnect', (): void => {
        // Unsubscribe all active subscriptions
        if (activeSubscriptions.size) {
            unsubscribe(activeSubscriptions.values());
        }
        socket.log.info('Client disconnected.');
    });

    function remove(s: ISubscription): void
    {
        s.removeAllListeners();
        activeSubscriptions.delete(s.correlationId);
        receivedSubscriptions.delete(s.correlationId);
    }

    function unsubscribe(subscriptions: ISubscription[],
                         notify: boolean = false): void
    {
        blpSocketSession.then((socket: Interface.ISocket): void => {
            socket.blpSession.unsubscribe(subscriptions);
            subscriptions.forEach(remove);
            socket.log.debug({ activeSubscriptions: activeSubscriptions.size },
                             'Unsubscribed.');
            if (notify && socket.isConnected()) {
                socket.notifyUnsubscribed(getCorrelationIds(subscriptions));
            }
        }).catch((err: Error): void => {
            socket.log.error(err, 'Error Unsubscribing');
            if (notify && socket.isConnected()) {
                socket.sendError('Error unsubscribing');
            }
        });
    }
}
