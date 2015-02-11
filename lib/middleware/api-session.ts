/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import restify = require('restify');
import _ = require('lodash');
import conf = require('../config');
import Session = require('../apisession/session');
import SessionStore = require('../apisession/session-store');
import Interface = require('../interface');

// GLOBAL
var SESSIONSTORE = new SessionStore(conf.get('expiration'));

// PUBLIC FUNCTIONS
export function createSession(req: Interface.IOurRequest,
                              res: Interface.IOurResponse,
                              next: restify.Next): void
{
    // Check to make sure client cert is present
    if (!_.has(req, 'clientCert')) {
        req.log.error('No client certificate found.');
        return next(new restify.InternalError('No client certificate found.'));
    }

    // Try to load the session associate with the fingerprint
    var apiSession: Session = SESSIONSTORE.get(req.clientCert.fingerprint);
    // Create a new session if no session found
    // Use client cert fingerprint as session key
    if (!apiSession) {
        SESSIONSTORE.set(req.clientCert.fingerprint, new Session(req.blpSession));
        req.log.debug('New apisession created.');
    }

    return next();
}

export function handleSession(req: Interface.IOurRequest,
                              res: Interface.IOurResponse,
                              next: restify.Next): void
{
    // Check to make sure client cert is present
    if (!_.has(req, 'clientCert')) {
        req.log.error('No client certificate found.');
        return next(new restify.InternalError('No client certificate found.'));
    }

    // Try to load the session associate with the fingerprint
    var apiSession: Session = SESSIONSTORE.get(req.clientCert.fingerprint);
    // Return error if no session found
    if (!apiSession) {
        req.log.debug('No active apisession found.');
        return next(new restify.BadRequestError('No active apisession found.'));
    }
    req.log.debug('apisession retrieved.');
    ++apiSession.inUse;
    req.apiSession = apiSession;    // Attach apisession to request

    res.once('finish', (): void => {
        --apiSession.inUse;
        assert(apiSession.inUse >= 0);
        req.log.debug({inuse: apiSession.inUse}, 'Response finished.');
    });

    // connection was terminated before response.end() was called
    res.once('close', (): void => {
        --apiSession.inUse;
        assert(apiSession.inUse >= 0);
        req.log.debug({inuse: apiSession.inUse},
                      'Connection was terminated before response.end() was called.');
    });

    return next();
}
