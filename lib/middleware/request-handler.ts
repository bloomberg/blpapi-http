/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import blpapi = require('blpapi');
import Promise = require('bluebird');
import _ = require('lodash');
import restify = require('restify');
import bunyan = require('bunyan');
import util = require('util');
import Interface = require('../interface');
import conf = require('../config');
import Subscription = require('../subscription/subscription');
import Session = require('../apisession/session');
import auth = require('./auth');

// Type used for request handlers dispatching, i.e. where the top level request includes some
// query param that we switch on to find the correct handler.
type ActionMap = {
    [index: string]: (req: Interface.IOurRequest,
                      res: Interface.IOurResponse,
                      next: restify.Next) => any;
};

// Type used for subscription input from request body
type SubscriptionOption = {
    correlationId: number;
    security: string;
    fields: string[];
    options?: any;
}

type ISubscription = Interface.ISubscription;

var SUBSCRIPTION_ACTION_MAP: ActionMap = {
    'start': onSubscribe,
    'stop':  onUnsubscribe
};

var AUTH_ACTION_MAP: ActionMap = {
    'token':     onGetToken,
    'authorize': onAuthorize
};

type Properties = {
    [index: string]: any;
}

// PRIVATE FUNCTIONS
function getSubscriptionsProp(subscriptions: ISubscription[]): Properties {
    var corrIds = subscriptions.map((s: ISubscription): number => {
        return s.correlationId;
    });
    var result: Properties = { 'correlationIds': corrIds };
    return result;
}

function validatePollId(session: Interface.IAPISession,
                        newPollId: number): {
                                                isValid: boolean;
                                                fetchNewData?: boolean;
                                            }
{
    if (newPollId === undefined) {
        return { isValid: false };
    }

    // Handle first request
    if (session.lastPollId === null) {
        session.lastPollId = newPollId;
        return { isValid: true,
                 fetchNewData: true};
    }

    if (session.lastPollId === session.lastSuccessPollId) {
        // Valid Poll Id. Poll old data
        if (session.lastPollId === newPollId) {
            session.lastPollId = newPollId;
            return { isValid: true,
                     fetchNewData: false};
        }
        // Valid Poll Id. Poll new data
        else if ((session.lastPollId + 1) === newPollId) {
            session.lastPollId = newPollId;
            return { isValid: true,
                     fetchNewData: true};
        }
        else {
            return { isValid: false };
        }
    }
    else {
        // Valid Poll Id. Poll new data
        if (session.lastPollId === newPollId) {
            session.lastPollId = newPollId;
            return { isValid: true,
                     fetchNewData: true};
        }
        else {
            return { isValid: false };
        }
    }
}

function startBuffers(subscriptions: ISubscription[]): Object[]
{
    var buffers: Object[] = [];
    // Check if we have new data for any subscriptions
    var hasNewData: boolean = _.some(subscriptions, (sub: ISubscription): boolean => {
        return !sub.buffer.isEmpty();
    });
    if (hasNewData) { // Start a new buffer for every subscription and return back the new data
        subscriptions.forEach((sub: ISubscription): void => {
            var buff: Interface.IBufferedData<Object> = sub.buffer.startNewBuffer();
            if (buff.buffer.length) {
                buffers.push({
                    'correlationId': sub.correlationId,
                    'data': buff.buffer,
                    'missed_ticks': buff.overflow
                });
            }
        });
    }
    return buffers;
}

function getOldBuffers(subscriptions: Interface.IMap<ISubscription>): Object[]
{
    var buffers: Object[] = [];
    subscriptions.forEach((sub: ISubscription): boolean => {
        if (!sub.buffer.isEmpty(1)) {  // Check if old buffer is empty
            var buff: Interface.IBufferedData<Object> = sub.buffer.getBuffer(1);
            buffers.push({
                'correlationId': sub.correlationId,
                'data': buff.buffer,
                'missed_ticks': buff.overflow
            });
        }
        return true;
    });
    return buffers;
}

// Used by routes that use the `action` query param to select the actual request handler.
function dispatchAction(actionMap: ActionMap,
                        req: Interface.IOurRequest,
                        res: Interface.IOurResponse,
                        next: restify.Next): void
{
    var action = req.query.action;
    if (!(action in actionMap)) {
        var errorString = util.format('Invalid action: %s', action);
        req.log.debug(errorString);
        return next(new restify.BadRequestError(errorString));
    }
    actionMap[action](req, res, next);
}

function onSubscribe(req: Interface.IOurRequest,
                     res: Interface.IOurResponse,
                     next: restify.Next): void
{
    // Validate input options
    if (!_.isArray(req.body) || !req.body.length) {
        return next(new restify.BadRequestError('Invalid subscription request body.'));
    }
    var errMessage: string;
    var isValid: boolean = _.every(req.body, (s: SubscriptionOption): boolean => {
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
        if (req.apiSession.receivedSubscriptions.has(s.correlationId)) {
            errMessage = util.format('Correlation Id %d already exist.', s.correlationId);
            return false;
        }
        return true;
    });
    if (!isValid) {
        req.log.debug(errMessage);
        return next(new restify.BadRequestError(errMessage));
    }
    if (req.body.length !== _(req.body).pluck('correlationId').uniq().value().length) {
        errMessage = 'Duplicate correlation Id received.';
        req.log.debug(errMessage);
        return next(new restify.BadRequestError(errMessage));
    }

    // Create Subscription object array and add event listeners
    var subscriptions: ISubscription[] = _.map(req.body, (s: SubscriptionOption): ISubscription => {
        var sub = new Subscription(s.correlationId,
                                   s.security,
                                   s.fields,
                                   s.options,
                                   conf.get('longpoll.maxbuffersize'));

        // Add event listener for each subscription
        sub.on('data', (data: any): void => {
            req.log.debug({data: {cid: sub.correlationId, time: process.hrtime()}},
                          'Data received');

            // Buffer the current data
            sub.buffer.pushValue(data);
        });

        // Must subscribe to the 'error' event; otherwise EventEmitter will throw an exception
        // that was occurring from the underlying blpapi.Session.  It is the assumed that the
        // blpapi.Session properly cleans up the subscription (i.e., 'unsubscribe()' should not
        // be called).
        sub.on('error', (err: Error): void => {
            req.log.error(err, 'blpapi.Session subscription error occurred.');
            sub.removeAllListeners();
            req.apiSession.activeSubscriptions.delete(sub.correlationId);
            req.apiSession.receivedSubscriptions.delete(sub.correlationId);
        });

        req.apiSession.receivedSubscriptions.set(sub.correlationId, sub);
        return sub;
    });

    // Build argument list for call to 'subscribe'.
    var args: any[] = [subscriptions];
    // Append optional arguments.
    if (req.identity) {
        args.push(req.identity);
    }
    // Subscribe user request through blpapi-node API.
    req.blpSession.subscribe.apply(req.blpSession, args)
        .then((): void => {
            if (!req.apiSession.expired) {
                subscriptions.forEach((s: ISubscription): void => {
                    req.apiSession.activeSubscriptions.set(s.correlationId, s);
                });
                req.log.debug('Subscribed');
                res.sendWhole(0, 'Subscribed', getSubscriptionsProp(subscriptions));
            } else { // Unsubscribe if session already expires
                req.blpSession.unsubscribe(subscriptions);
                subscriptions.forEach((s: ISubscription): void => {
                    s.removeAllListeners();
                    req.apiSession.receivedSubscriptions.delete(s.correlationId);
                });
                req.log.debug('Unsubscribed all active subscriptions');
            }
            return next();
        })
        .catch((err: Error): any => {
            subscriptions.forEach((s: ISubscription): void => {
                req.apiSession.receivedSubscriptions.delete(s.correlationId);
                s.removeAllListeners();
            });
            req.log.error(err, 'Request error.');
            return next(new restify.InternalError(err.message));
        });
}

function onUnsubscribe(req: Interface.IOurRequest,
                       res: Interface.IOurResponse,
                       next: restify.Next): void
{
    if (!req.apiSession.activeSubscriptions.size) {
        req.log.debug('No active subscriptions.');
        return next(new restify.BadRequestError('No active subscriptions.'));
    }

    var subscriptions: ISubscription[] = [];
    // If no correlation Id specified,
    // the default behavior is to unsubscribe all active subscriptions
    if (!req.body) {
        subscriptions = req.apiSession.activeSubscriptions.values();
    } else {
        // If we do receive req.body object, first check if it is valid(empty list is INVALID)
        if (!_.has(req.body, 'correlationIds') ||
            !_.isArray(req.body.correlationIds) ||
            !req.body.correlationIds.length) {
            req.log.debug('Invalid unsubscribe data.');
            return next(new restify.InvalidArgumentError('Invalid unsubscribe data.'));
        }
        // Next, validate all correlation Ids
        // Will error if any invalid correlation Id received
        var errMessage: string;
        var isAllValid = _.every(_.uniq(req.body.correlationIds), (cid: number): boolean => {
            if (req.apiSession.activeSubscriptions.has(cid)) {
                subscriptions.push(req.apiSession.activeSubscriptions.get(cid));
                return true;
            }

            errMessage = util.format('Invalid correlation Id %d received.', cid);
            return false;
        });
        if (!isAllValid) {
            req.log.debug(errMessage);
            return next(new restify.InvalidArgumentError(errMessage));
        }
    }

    try {
        req.blpSession.unsubscribe(subscriptions);
        var result: Object[] = startBuffers(subscriptions);
        subscriptions.forEach((sub: ISubscription): void => {
            sub.removeAllListeners();
            req.apiSession.activeSubscriptions.delete(sub.correlationId);
            req.apiSession.receivedSubscriptions.delete(sub.correlationId);
        });
        req.log.debug({ activeSubscriptions:
                       req.apiSession.activeSubscriptions.size },
                      'Unsubscribed.');

        // Reset poll Id to null if all subscriptions get unsubscribed
        if (!req.apiSession.receivedSubscriptions.size) {
            req.apiSession.lastPollId = req.apiSession.lastSuccessPollId = null;
        }

        res.sendChunk(result);
        res.sendOtherProp(getSubscriptionsProp(subscriptions));
        res.sendEnd(0, 'Unsubscribed Successfully');
        return next();
    } catch (err) {
        req.log.error(err, 'Unsubscription error');
        return next(new restify.InternalError(err.message));
    }
}

function onGetToken(req: Interface.IOurRequest,
                    res: Interface.IOurResponse,
                    next: restify.Next): void
{
    req.blpSession.authenticate().then((token: string): void => {
        res.sendWhole(0, 'OK', null /* properties */, token);
        return next();
    }).catch((err: Error): void => {
        return next(res.sendError(err));
    });
}

function onAuthorize(req: Interface.IOurRequest,
                     res: Interface.IOurResponse,
                     next: restify.Next): void
{
    // Validate authorization request.
    var errorString: string = null;
    var token = req.header('blpapi-token');
    if (!token || token.length === 0) {
        errorString = 'Authorizing requires a "blpapi-token" in the request header.';
    } else if (!_.has(req, 'clientCert')) {
        // We currently use the clientCert as the key when managing identities, so authorization
        // requests require you to have one.
        errorString = 'Authorizing requires a client cert';
    }
    if (errorString) {
        req.log.debug(errorString);
        return next(new restify.BadRequestError(errorString));
    }

    req.blpSession.authorize(token).
        then((identity: blpapi.IIdentity): void => {
            auth.setIdentity(req, identity);
            res.sendWhole(0, 'OK');
            return next();
        })
        .catch((err: Error): void => {
            return next(res.sendError(err));
        });
}

// PUBLIC FUNCTIONS
export function verifyContentType(req: Interface.IOurRequest,
                                  res: Interface.IOurResponse,
                                  next: restify.Next): void
{
    // Check the content type of the request
    // TODO: configure acceptable content-type
    if (!req.is('application/json')) {
        req.log.debug('Unsupported Content-Type.');
        return next(new restify.UnsupportedMediaTypeError('Unsupported Content-Type.'));
    }

    return next();
}

export function elevateRequest (req: Interface.IOurRequest,
                                res: Interface.IOurResponse,
                                next: restify.Next): void
{
    var chunkIndex: number = 0;
    var otherProperties: Properties = {};

    /**
     * This is called each time data is added to the response.
     * @param isEnd Whether this is the last time this will be called for this http request.
     * @returns {string} Text that should be added to the response before the caller adds its data.
     */
    function prepareResponseText(isEnd: boolean): string {
        var text: string;
        if (1 === ++chunkIndex) {
            // This is the first time we're adding response text. Set the headers as well.
            res.statusCode = 200;
            res.setHeader('content-type', 'application/json');
            // If isEnd is true, then we aren't actually adding a data array to the http response.
            text = isEnd ? '{' : '{"data":[';
        } else {
            // If isEnd is true, we must have previously added data to the response, so we need to
            // close the data array.
            text = isEnd ? '],' : ',';
        }
        assert(text, 'Response text was not set');
        return text;
    }

    function stringifyPair ( key: string, value: any ): string {
        return '"' + key.replace(/'/g, '\\$&') + '":' + JSON.stringify(value);
    }

    // Right now we only use restify.InternalError(500)
    // TODO: Add error type differentiation
    function createError(err: Error): any {
        return new restify.InternalError(err.message);
    }

    function preparePropertiesText(properties: Properties): string {
        return _.reduce(properties,
                        (text: string, value: string, property: string): string => {
                            return text + ',' + stringifyPair(property, value);
                        },
                        '' /* initial value */);
    }

    function prepareEndText(status: number,
                            message: string,
                            properties: Properties): string {
        return util.format('%s%s,%s%s}',
                           prepareResponseText(true),
                           stringifyPair('status', status),
                           stringifyPair('message', message || ''),
                           properties ? preparePropertiesText(properties) : '');
    }

    res.sendChunk = (data: any): void => {
        var text = prepareResponseText(false);
        res.write(text + JSON.stringify(data));
    };

    res.sendOtherProp = (properties: Properties): void => {
        // For now just cache the additional properties they will be
        // bundled into the response in 'sendEnd'.
        _.assign(otherProperties, properties);
    };

    res.sendEnd = (status: number, message: string): void => {
        res.end(prepareEndText(status, message, otherProperties));
    };

    // Generate and send a full response.
    res.sendWhole = (status: number,
                     message: string,
                     properties?: Properties,
                     data?: any): void => {
        // Make sure we don't interlace calls to this function with
        // calls to functions generating only part of the response.
        assert(chunkIndex === 0 && _.isEmpty(otherProperties));
        var text = '';
        if (data) {
            text = prepareResponseText(/* isEnd */ false) + JSON.stringify(data);
        }
        res.end(text + prepareEndText(status, message, properties));
    };

    res.sendError = (err: Error): void|any => {
        // send Error if this is the first chunk
        if (chunkIndex === 0) {
            return createError(err);
        }
        // Otherwise, set -1 as status code and error message
        return res.sendEnd(-1, err.message);
    };

    return next();
}

export function onRequest(req: Interface.IOurRequest,
                          res: Interface.IOurResponse,
                          next: restify.Next): void
{
    assert(req.blpSession, 'blpSession not found');
    var uri = util.format('//%s/%s', req.query.ns, req.query.service);

    // Build argument list for call to 'request'.
    var args = [uri,
                req.query.type,
                req.body];

    // Append optional arguments (identity and callback).
    if (req.identity) {
        args.push(req.identity);
    }
    args.push((err: Error, data?: any, last?: boolean): void =>
              {
                  if (err) {
                      req.log.error(err, 'Request error.');
                      return next(res.sendError(err));
                  }
                  res.sendChunk(data);
                  if (last) {
                      res.sendEnd(0, 'OK');
                      return next();
                  }
              });

    req.blpSession.request.apply(req.blpSession, args);
}

export function onPollSubscriptions(req: Interface.IOurRequest,
                                    res: Interface.IOurResponse,
                                    next: restify.Next): void
{
    assert(req.apiSession, 'apiSession not found');

    if (!req.apiSession.activeSubscriptions.size) {
        req.log.debug('No active subscriptions.');
        return next(new restify.BadRequestError('No active subscriptions.'));
    }

    var interval: NodeJS.Timer;
    var frequency: number = conf.get('longpoll.pollfrequency');
    var timeOut: number = conf.get('longpoll.polltimeout');
    var pollId: number = _.parseInt(req.query.pollid);

    var validateIdResult = validatePollId(req.apiSession, pollId);
    if (!validateIdResult.isValid) {
        req.log.debug('Invalid Poll Id ' + req.query.pollid);
        return next(new restify.InvalidArgumentError('Invalid Poll Id '
                                                     + req.query.pollid));
    }

    var p: Promise<Object[]>;
    if (validateIdResult.fetchNewData) {
        // For fetching new data
        p = ((): Promise<Object[]> => {
                req.log.debug('Long polling...');
                var buff = startBuffers(req.apiSession.activeSubscriptions.values());
                if (buff.length) {
                    req.apiSession.lastSuccessPollId = pollId;
                    req.log.debug('Got data. Sent back.');
                    return Promise.resolve(buff);
                }

                return (new Promise<Object[]>((resolve: (result: Object[]) => void,
                                               reject: (error: Error) => void): void => {
                    interval = setInterval(
                        (): void => {
                            if (!req.apiSession.activeSubscriptions.size) {
                                clearInterval(interval);
                                reject(new Error('No active subscriptions'));
                            }
                            var buffer = startBuffers(req.apiSession.activeSubscriptions.values());
                            if (buffer.length) {
                                clearInterval(interval);
                                req.apiSession.lastSuccessPollId = pollId;
                                req.log.debug('Got data. Sent back.');
                                resolve(buffer);
                            }
                        },
                        frequency);
                }))
                    .timeout(timeOut)
                    .cancellable();
            })();
    } else {
        // For fetching old data
        p = ((): Promise<Object[]> => {
                req.log.debug('Old poll id received. Resent last sent data.');
                return Promise.resolve(getOldBuffers(req.apiSession.activeSubscriptions));
            })();
    }

    p.then((result: Object[]): void => {
        res.sendChunk(result);
        res.sendEnd(0, 'OK');
        return next();
    })
        .catch(Promise.TimeoutError, (err: Error): any => {
            if (interval) {
                clearInterval(interval);
            }
            var message: string = 'No subscription data within ' + timeOut + 'ms.';
            req.log.debug(message);
            return next(new restify.RequestTimeoutError(message));
        })
        .catch(Promise.CancellationError, (err: Error): any => {
            req.log.debug('OnPoll promise get canceled');
            return next();
        })
        .catch((err: Error): any => {
            if (interval) {
                clearInterval(interval);
            }
            req.log.error(err, 'Poll error.');
            return next(new restify.InternalError(err.message));
        });

    // connection was terminated before response.end() was called
    res.once('close', (): void => {
        if (interval) {
            clearInterval(interval);
        }
        if (p.isCancellable()) {
            p.cancel();
        }
    });
}

export function getSubscriptionActions(): string[]
{
    return _.keys(SUBSCRIPTION_ACTION_MAP);
}

export function onChangeSubscriptions(req: Interface.IOurRequest,
                                      res: Interface.IOurResponse,
                                      next: restify.Next): void
{
    dispatchAction(SUBSCRIPTION_ACTION_MAP, req, res, next);
}

export function getAuthActions(): string[]
{
    return _.keys(AUTH_ACTION_MAP);
}

export function onAuth(req: Interface.IOurRequest,
                       res: Interface.IOurResponse,
                       next: restify.Next): void
{
    dispatchAction(AUTH_ACTION_MAP, req, res, next);
}
