/// <reference path='../typings/tsd.d.ts' />

import Promise = require('bluebird');
import restify = require('restify');
import BAPI = require('./blpapi-wrapper');

export interface IOurRequest extends restify.Request {
    clientCert?: any;
    blpSession: BAPI.Session;
}

export interface IOurResponse extends restify.Response {
    sendChunk?: (data: any) => Promise<void>;
    sendEnd?: (status: any, message: string) => Promise<void>;
    sendError?: (err: any, where: string, reason?: any) => Promise<void>;
}
