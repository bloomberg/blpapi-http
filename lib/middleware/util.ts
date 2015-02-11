/// <reference path='../../typings/tsd.d.ts' />

import tls = require('tls');
import _ = require('lodash');
import restify = require('restify');
import Interface = require('../interface');
import conf = require('../config');

// Override request content-type so it is not mandatory for client
export function resetContentType(req: Interface.IOurRequest,
                                 res: Interface.IOurResponse,
                                 next: restify.Next): void
{
    req.headers['content-type'] = 'application/json';

    return next();
}

export function getCert(req: Interface.IOurRequest,
                        res: Interface.IOurResponse,
                        next: restify.Next): void
{
    // Get client certificate details(only in https mode)
    if (req.isSecure()) {
        req.clientCert = (<tls.ClearTextStream>req.connection).getPeerCertificate();
    }

    return next();
}

export function log(req: Interface.IOurRequest,
                    res: Interface.IOurResponse,
                    next: restify.Next): void
{
    // Log request details
    req.log.info({req: req}, 'Request received.');

    // Log client certificate details(only in https mode)
    if (conf.get('logging.clientDetail') && _.has(req, 'clientCert')) {
        req.log.debug({cert: req.clientCert}, 'Client certificate.');
    }

    // Log request body
    if (req.body && conf.get('logging.reqBody')) {
        req.log.debug({body: req.body}, 'Request Body');
    }

    return next();
}

export function after(req: Interface.IOurRequest,
                      res: Interface.IOurResponse,
                      next: restify.Next): void
{
    req.log.info({res: res}, 'Response sent.');
}

export function rejectHTTP(req: Interface.IOurRequest,
                           res: Interface.IOurResponse,
                           next: restify.Next): void
{
    if (!req.isSecure()) {
        req.log.debug('Invalid request. HTTP request received where HTTPS is expected');
        return next(new restify.BadRequestError(
            'Invalid request. HTTP request received where HTTPS is expected'));
    }

    return next();
}
