/// <reference path='../typings/tsd.d.ts' />

import Promise = require('bluebird');
import restify = require('restify');
import tls = require('tls');
import bunyan = require('bunyan');
import _ = require('lodash');
import conf = require('./config');
import Session = require('./Session');
import SessionStore = require('./SessionStore');
import BAPI = require('./blpapi-wrapper');

export class APISession {
    private sessionStore: SessionStore<Session>;
    private logger: bunyan.Logger;
    private blpSession: BAPI.Session;

    constructor(blpsess: BAPI.Session) {
        this.logger = bunyan.createLogger(conf.get('loggerOptions'));
        this.sessionStore = new SessionStore<Session>(conf.get('expiration'));
        this.blpSession = blpsess;
        this.logger.debug('Session store created.');
    }

    public handleRequest (): (req: OurRequest,
                              res: OurResponse,
                              next: (err?: any) => any ) => void {
        return function handleRequest ( req: OurRequest,
                                        res: OurResponse,
                                        next: (err?: any) => any ): void {
            var chunkIndex: number = 0;
            var chunk: string; // the current chunk string is assembled here
            var needComma: boolean = false; // need to append a ',' before adding more data

            // Check the content type of the request
            // TODO: configure acceptable content-type
            if (!req.is('application/json')) {
                req.log.debug('Unsupported Content-Type.');
                return next(new restify.UnsupportedMediaTypeError('Unsupported Content-Type.'));
            }

            // Get client certificate details(only in https mode)
            if (conf.get('https.enable')) {
                req.clientCert = (<tls.ClearTextStream>req.connection).getPeerCertificate();
            }

            // returns a promise
            function prepareResponse (): Promise<any> {
                var resultP: Promise<any> = undefined;
                if (++chunkIndex === 1) {
                    res.setHeader('content-type', 'application/json');
                    chunk = '{';
                    needComma = false;
                } else {
                    chunk = '';
                }

                return resultP || Promise.resolve(undefined);
            };

            function stringifyPair ( key: string, value: any ): string {
                return '"' + key.replace(/'/g, '\\$&') + '":' + JSON.stringify(value);
            }

            res.sendChunk = (data: any): Promise<any> => {
                var p = prepareResponse();
                return p.then((): void => {
                    if (chunkIndex === 1) {
                        res.statusCode = 200;
                        if (needComma) {
                            chunk += ',';
                        }
                        chunk += '"data":[';
                        needComma = false;
                    }
                    if (needComma) {
                        chunk += ',';
                    }
                    res.write( chunk + JSON.stringify(data) );
                    needComma = true;
                });
            };

            res.sendEnd = (status: string, message: string): Promise<any> => {
                var p = prepareResponse();
                return p.then((): void => {
                    // If this is the only chunk, we can set the http status
                    if (chunkIndex === 1) {
                        res.statusCode = 200;
                    } else {
                        chunk += ']';
                        needComma = true;
                    }
                    if (needComma) {
                        chunk += ',';
                    }
                    chunk += stringifyPair( 'status', status ) + ',' +
                             stringifyPair( 'message', message || '' ) +
                             '}';
                    res.end( chunk );
                    needComma = false;
                    chunk = '';
                });
            };

            res.sendError = function(err, where, reason): Promise<any> {
                var status: { source: string; category: string; errorCode: number};
                var r = err.data && err.data.reason;
                if (r) {
                    status = {source: r.source, category: r.category, errorCode: r.errorCode};
                } else if (reason) {
                    status = { source: 'BProx', category: reason.category, errorCode: -1};
                } else {
                    status = {source: 'BProx', category: 'UNCLASSIFIED', errorCode: -1};
                }
                return res.sendEnd( status, err.message || where );
            };

            return next();
        };
    }

    public createSession (): (req: OurRequest,
                              res: OurResponse,
                              next: (err?: any) => any ) => void {
        var sessionStore = this.sessionStore;
        var blpSession = this.blpSession;
        return function createSession ( req: OurRequest,
                                        res: OurResponse,
                                        next: (err?: any) => any ): void {

            // Check to make sure client cert is present
            if (!_.has(req, 'clientCert')) {
                req.log.error('No client certificate found.');
                return next(new restify.InternalError('No client certificate found.'));
            }

            // Try to load the session associate with the fingerprint
            var session: Session = sessionStore.get(req.clientCert.fingerprint);
            // Create a new session if no session found
            if (!session) {
                session = new Session(req.clientCert.fingerprint, blpSession);
                sessionStore.set(req.clientCert.fingerprint, session);
                req.log.debug('New session created.');
            }

            return next();
        };
    }

    public handleSession (): (req: OurRequest,
                              res: OurResponse,
                              next: (err?: any) => any ) => void {
        var sessionStore = this.sessionStore;
        return function handleSession ( req: OurRequest,
                                        res: OurResponse,
                                        next: (err?: any) => any ): void {

            // Check to make sure client cert is present
            if (!_.has(req, 'clientCert')) {
                req.log.error('No client certificate found.');
                return next(new restify.InternalError('No client certificate found.'));
            }

            // Try to load the session associate with the fingerprint
            var session: Session = sessionStore.get(req.clientCert.fingerprint);
            // Return error if no session found
            if (!session) {
                req.log.debug('No active session found.');
                return next(
                    new restify.BadRequestError('No active session found. Please re-subscribe'));
            }
            req.log.debug('Session retrieved.');
            ++session.inUse;
            req.session = session;

            res.once('finish', (): void => {
                --session.inUse;
                req.log.debug({inuse: session.inUse}, 'Response finished.');
            });

            // connection was terminated before response.end() was called
            res.once('close', (): void => {
                --session.inUse;
                req.log.debug({inuse: session.inUse},
                              'Connection was terminated before response.end() was called.');
            });

            return next();
        };
    }
}

export interface OurRequest extends restify.Request {
    clientCert?: any;
    session?: Session;
}

export interface OurResponse extends restify.Response {
    sendChunk?: (data: any) => Promise<any>;
    sendEnd?: (status: any, message: string) => Promise<any>;
    sendError?: (err: any, where: string, reason?: any) => Promise<any>;
}
