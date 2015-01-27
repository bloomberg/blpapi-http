/// <reference path="../typings/tsd.d.ts" />
import Promise = require('bluebird');
import restify = require('restify');
import _ = require('lodash');
import apiSession = require('./api-session');
import BAPI = require('./blpapi-wrapper');
import conf = require('./config');
import Subscription = require('./SubscriptionWithBuffer');
import Session = require('./Session');

export = RequestHandler;

class RequestHandler {
    private blpSession: BAPI.Session;

    constructor(blpsess: BAPI.Session) {
        this.blpSession = blpsess;
    }

    private static validatePollId(session: Session, newPollId: number) : any {
        if (newPollId === undefined) {
            return { isValid: false };
        }

        // Handle first request
        if (session.lastPollId === undefined) {
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

    public onRequest(): (req: apiSession.OurRequest,
                         res: apiSession.OurResponse,
                         next: (err?: any) => any ) => void {
        var blpSession = this.blpSession;
        return function onRequest(req: apiSession.OurRequest,
                                  res: apiSession.OurResponse,
                                  next: (err?: any) => any ): void {

            (() : Promise<any> => {
                return (new Promise<any>((resolve : () => void,
                                          reject : (error : any) => void) : void => {
                    blpSession.request('//' + req.params.ns + '/' + req.params.svName,
                        req.params.reqName,
                        req.body,
                        (err: Error, data: any, last: boolean): void => {
                            if (err) {
                                reject(err);
                                return;
                            }
                            var p = res.sendChunk( data );
                            if (last) {
                                p.then((): Promise<any> => {
                                    return res.sendEnd( 0, 'OK' );
                                }).then(resolve);
                            }
                        });
                }));
            })()
            .then(next)
            .catch( (err: Error): any => {
                req.log.error(err, 'Request error.');
                return next(new restify.InternalError(err.message));
            });
        };
    }

    public onSubscribe(): (req: apiSession.OurRequest,
                           res: apiSession.OurResponse,
                           next: (err?: any) => any ) => void {
        var blpSession = this.blpSession;
        return function onSubscribe (req: apiSession.OurRequest,
                                     res: apiSession.OurResponse,
                                     next: (err?: any) => any ): void {
            if (!req.session) {
                req.log.error('No session object found.');
                return next(new restify.InternalError('No session object found.'));
            }

            var subscriptions : Subscription[] = [];
            ((): Promise<any> => {
                req.body.forEach((s: any): void => {
                    // Check if all requests are valid
                    // The Subscribe request will proceed only if all subscriptions are valid
                    if (s.correlationId === undefined || !s.security || !s.fields) {
                        throw new Error('Invalid subscription request.');
                    }
                    if (req.session.receivedSubscriptions.has(s.correlationId)) {
                        throw new Error('Correlation Id ' + s.correlationId + ' already exist.');
                    }

                    var sub = new Subscription(s.correlationId,
                                               s.security,
                                               s.fields,
                                               conf.get('longPoll.maxBufferSize'),
                                               s.options);
                    subscriptions.push(sub);

                    // Create buffers for each cid
                    req.session.receivedSubscriptions.add(sub);

                    // Add event listener for each subscription
                    sub.on('data', (data : any) : void => {
                        if (!req.session.activeSubscriptions.has(sub)) {
                            throw new Error('Invalid Correlation Id: ' + sub.correlationId);
                        }

    // For debug purpose
    var ts = process.hrtime();
    req.log.debug({data: {cid: sub.correlationId, time: ts}}, 'Data received');
    data['DEBUG_TIME'] = ts[0] + '.' + ts[1];

                        // Buffer the current data
                        sub.pushBuffer(data);
                    });
                });

                // Subscribe user request through blpapi-wrapper
                return blpSession.subscribe(subscriptions);
            })()
            .then( () : Promise<any> => {
                if (!req.session.expired) {
                    subscriptions.forEach((s: Subscription): void => {
                        req.session.activeSubscriptions.add(s);
                    });
                    req.log.debug('Subscribed');
                    return res.sendEnd(0, 'Subscribed');
                } else { // Unsubscribe if session already expires
                    try {
                        blpSession.unsubscribe(subscriptions);
                    } catch (ex) {
                        req.log.error(ex, 'Error Unsubscribing');
                    }
                    subscriptions.forEach((s: Subscription): void => {
                        s.removeAllListeners();
                        req.session.receivedSubscriptions.delete(s);
                    });
                    req.log.debug('Unsubscribed all active subscriptions');
                    return Promise.resolve();
                }
            })
            .then(next)
            .catch( (err : any): any => {
                subscriptions.forEach((s: Subscription): void => {
                    req.session.receivedSubscriptions.delete(s);
                    s.removeAllListeners();
                });
                req.log.error(err, 'Request error.');
                return next(new restify.InternalError(err.message));
            });
        };
    }

    public onPoll(): (req: apiSession.OurRequest,
                      res: apiSession.OurResponse,
                      next: (err?: any) => any) => void {
        var blpSession = this.blpSession;
        return function onPoll (req : apiSession.OurRequest,
                                res : apiSession.OurResponse,
                                next: (err?: any) => any ): void {

            if (!req.session) {
                req.log.error('No session object found.');
                return next(new restify.InternalError('No session object found.'));
            }

            if (!req.session.activeSubscriptions || !req.session.activeSubscriptions.size) {
                req.log.debug('Bad poll request. No active subscriptions.');
                return next(new restify.BadRequestError('No active subscriptions.'));
            }

            var interval : NodeJS.Timer;
            var frequency : number = conf.get('longPoll.pollFrequency');
            var timeOut : number = conf.get('longPoll.pollTimeout');
            var pollId : number = _.parseInt(req.params.pollid);

            var validateIdResult = RequestHandler.validatePollId(req.session, pollId);
            if (!validateIdResult.isValid) {
                req.log.debug('Invalid Poll Id ' + req.params.pollid);
                return next(new restify.InvalidArgumentError('Invalid Poll Id '
                                                             + req.params.pollid));
            }

            var p : Promise<any> = validateIdResult.fetchNewData
               ? ((): Promise<any> => {
                    req.log.debug('Long polling...');
                    req.session.activeSubscriptions.clearAllBuffers();
                    var buff : {}[] = req.session.activeSubscriptions.getAllNewBuffers();
                    if (buff.length) {
                        req.session.lastSuccessPollId = pollId;
                        req.log.debug('Got data. Sent back.');
                        return Promise.resolve(buff);
                    }

                    return (new Promise<any>((resolve : (result : {}[]) => void,
                                              reject : (error : any) => void) : void => {
                        interval = setInterval(() : void => {
                            if (!req.session.activeSubscriptions.size) {
                                clearInterval(interval);
                                reject('No active subscriptions');
                            }
                            var buffer : {}[] = req.session.activeSubscriptions.getAllNewBuffers();
                            if (buffer.length) {
                                clearInterval(interval);
                                req.session.lastSuccessPollId = pollId;
                                req.log.debug('Got data. Sent back.');
                                resolve(buffer);
                            }
                        }, frequency);
                    })).timeout(timeOut);
                })()
               : ((): Promise<any> => {
                    req.log.debug('Old poll id received. Resent last sent data.');
                    return Promise.resolve(req.session.activeSubscriptions.getAllOldBuffers());
                })();

            p.then((result : {}[]) : Promise<any> => {
                return res.sendChunk(result);
            })
            .then(() : Promise<any> => {
                return res.sendEnd( 0, 'OK' );
            })
            .then(next)
            .catch(Promise.TimeoutError, (err : any) : Promise<any> => {
                if (interval) {
                    clearInterval(interval);
                }
                var message: string = 'No subscription data within ' + timeOut + 'ms.';
                req.log.debug(message);
                return next(new restify.RequestTimeoutError(message));
            })
            .catch( (err : any) : Promise<any> => {
                if (interval) {
                    clearInterval(interval);
                }
                req.log.error(err, 'Poll error.');
                return next(new restify.InternalError(err.message));
            });

            req.on('close', () : void => {
                if (interval) {
                    clearInterval(interval);
                }
            });
        };
    }

    public onUnsubscribe(): (req: apiSession.OurRequest,
                             res: apiSession.OurResponse,
                             next: (err?: any) => any) => void {
        var blpSession = this.blpSession;
        return function onUnsubscribe (req : apiSession.OurRequest,
                                       res : apiSession.OurResponse,
                                       next: (err?: any) => any ): void {
            if (!req.session) {
                req.log.error('No session object found.');
                return next(new restify.InternalError('No session object found.'));
            }

            if (!req.session.activeSubscriptions || !req.session.activeSubscriptions.size) {
                req.log.debug('Bad unsubscribe request. No active subscriptions.');
                return next(new restify.BadRequestError('No active subscriptions.'));
            }

            var correlationIds: number[] = (req.method === 'GET')
                                            ? new Array<number>()
                                            : req.body.correlationIds;

            ((): Promise<any> => {
                var subscriptions : Subscription[] = [];

                // If no correlation Id specified,
                // the default behavior is to unsubscribe all active subscriptions
                if (!correlationIds || !correlationIds.length) {
                    subscriptions = req.session.activeSubscriptions.getAll();
                }

                // Otherwise, validate all correlation Id
                // Will unsubscribe only the valid correlation Id, ignore the rest
                correlationIds.forEach((cid: number): void => {
                    if (req.session.activeSubscriptions.has(cid)) {
                        subscriptions.push(req.session.activeSubscriptions.get(cid));
                    }
                });

                if (!subscriptions.length) {
                    req.log.debug('No valid correlation Id.');
                    return next(new restify.InvalidArgumentError('No valid correlation Id.'));
                }

                var result : {}[] = [];
                blpSession.unsubscribe(subscriptions);
                subscriptions.forEach((sub: Subscription): void => {
                    sub.removeAllListeners();
                    if (sub.hasNewBufferData()) {
                        result.push(sub.flushBuffer());
                    }
                    req.session.activeSubscriptions.delete(sub);
                    req.session.receivedSubscriptions.delete(sub);
                });
                req.log.debug({activeSubscriptions:
                                req.session.activeSubscriptions.size}, 'Unsubscribed.');

                // Reset poll Id to undefined if all subscriptions get unsubscribed
                if (!req.session.receivedSubscriptions.size) {
                    req.session.lastPollId = req.session.lastSuccessPollId = undefined;
                }

                return Promise.resolve(result);
            })()
            .then((result : {}[]) : Promise<any> => {
                return res.sendChunk(result);
            })
            .then(() : Promise<any> => {
                return res.sendEnd( 0, 'Unsubscribe Successfully' );
            })
            .then(next)
            .catch( (err : any) : Promise<any> => {
                req.log.error(err, 'Unsubscription error');
                return next(new restify.InternalError(err.message));
            });
        };
    }

}
