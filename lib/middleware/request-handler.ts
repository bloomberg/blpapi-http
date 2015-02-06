/// <reference path='../../typings/tsd.d.ts' />

import Promise = require('bluebird');
import restify = require('restify');
import bunyan = require('bunyan');
import Interface = require('../interface');
import conf = require('../config');

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
    var chunk: string; // the current chunk string is assembled here
    var needComma: boolean = false; // need to append a ',' before adding more data

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

    res.sendChunk = (data: any): Promise<void> => {
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

    res.sendEnd = (status: string, message: string): Promise<void> => {
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

    res.sendError = function(err: any, where: string, reason: any): Promise<void> {
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
}

export function onRequest(req: Interface.IOurRequest,
                          res: Interface.IOurResponse,
                          next: restify.Next): void
{
    if (!req.blpSession) {
        req.log.error('Error not find blpSession.');
        return next(new restify.InternalError('Error not find blpSession.'));
    }

    ((): Promise<any> => {
        return (new Promise<any>((resolve: () => void,
                                  reject: (error: any) => void): void => {
            req.blpSession.request('//' + req.params.ns + '/' + req.params.svName,
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
}
