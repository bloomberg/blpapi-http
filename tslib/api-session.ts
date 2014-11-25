/// <reference path='../typings/tsd.d.ts' />

import assert = require('assert');
import http = require('http');

import Promise = require('bluebird');
var uid = require('uid-safe');
var parseurl = require('parseurl');
var qs = require('qs');
var ipwareMod = require('ipware');
var ipware = ipwareMod();

var config = require('../lib/config.js');
import SessionStore = require('./SessionStore');

function stringifyPair ( key: string, value: any ): string {
    return '"' + key.replace(/'/g, '\\$&') + '":' + JSON.stringify(value);
}

export interface OurRequest extends http.ServerRequest {
    parsedQuery?: any;
    session?: any;
    clientIp?: string;
    clientIpRoutable?: boolean;
}

export interface OurResponse extends http.ServerResponse {
    sendChunk?: (data: any) => Promise<any>;
    sendEnd?: (status: any, message: string) => Promise<any>;
    sendError?: (err: any, where: string, reason?: any) => Promise<any>;
}

export function makeHandler (): (req: OurRequest, res: OurResponse, next: Function ) => void
{
    var G_STORE = new SessionStore<any>(config.get('expiration'));

    return function handleSession ( req: OurRequest, res: OurResponse, next: Function ): void {
        var parsed = parseurl(req);
        var parsedQuery = qs.parse(parsed.query);

        var chunkIndex: number = 0;
        var useJsonp: boolean = !!parsedQuery.jpcb;
        var chunk: string; // the current chunk string is assembled here
        var needComma: boolean = false; // need to append a ',' before adding more data

        req.parsedQuery = parsedQuery;

        ipware.get_ip(req); // sets req.clientIp and req.clientIpRoutable

        // If a session was specified in the query, try to load it
        var session = parsedQuery.sessid && G_STORE.get(parsedQuery.sessid);
        if (session) {
            ++session.inUse;
            req.session = session;
        }

        // returns a promise
        function prepareSession (): Promise<any> {
            var resultP: Promise<any> = undefined;
            // Before sending the first chunk we must take care of the session id and set the
            // content type
            if (++chunkIndex === 1) {
                res.setHeader('content-type', parsedQuery.callback ? 'text/javascript' :
                                                                     'application/json');

                chunk = useJsonp ? parsedQuery.jpcb + '({' : '{';
                needComma = false;

                // if the request has an associated session, make sure it has an id, generating one
                // if needed, and store it in the session store.
                if (req.session) {
                    resultP = Promise.resolve(req.session.sessid || uid(24)).then(function(sessid) {
                        req.session.sessid = sessid;
                        G_STORE.set(sessid, req.session);
                        chunk += stringifyPair( 'sessid', req.session.sessid );
                        needComma = true;
                    });
                }
            } else {
                chunk = '';
            }

            return resultP || Promise.resolve(undefined);
        };

        res.sendChunk = function ( data ): Promise<any> {
            var p = prepareSession();
            return p.then(function() {
                if (chunkIndex === 1) {
                    res.statusCode = 200;
                    if (needComma) {
                        chunk += ',';
                    }
                    chunk += '\'data\':[';
                    needComma = false;
                }
                if (needComma) {
                    chunk += ',';
                }
                res.write( chunk + JSON.stringify(data) );
                needComma = true;
            });
        };

        res.sendEnd = function(status, message): Promise<any> {
            var p = prepareSession();
            return p.then(function() {
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
                if (useJsonp) {
                    chunk += ')';
                }
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

        // Monkey-patch response.end() to track the lifetime of the response
        var savedEnd = res.end;
        res.end = function(data?: any, encoding?: any, cb?: any) {
            savedEnd.call( res, data, encoding, cb );
            if (session) {
                --session.inUse;
            }
        };

        return next();
    };
};
