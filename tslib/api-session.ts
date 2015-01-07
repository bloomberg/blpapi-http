/// <reference path='../typings/tsd.d.ts' />

import assert = require('assert');
import http = require('http');
import Promise = require('bluebird');
var ipwareMod = require('ipware');
var ipware = ipwareMod();

function stringifyPair ( key: string, value: any ): string {
    return '"' + key.replace(/'/g, '\\$&') + '":' + JSON.stringify(value);
}

export interface OurRequest extends http.ServerRequest {
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
    return function handleSession ( req: OurRequest, res: OurResponse, next: Function ): void {
        var chunkIndex: number = 0;
        var chunk: string; // the current chunk string is assembled here
        var needComma: boolean = false; // need to append a ',' before adding more data

        ipware.get_ip(req); // sets req.clientIp and req.clientIpRoutable

        // returns a promise
        function prepareSession (): Promise<any> {
            var resultP: Promise<any> = undefined;
            // Before sending the first chunk we must take care of the session id and set the
            // content type
            if (++chunkIndex === 1) {
                res.setHeader('content-type', 'application/json');
                chunk = '{';
                needComma = false;
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
                    chunk += '\"data\":[';
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
};
