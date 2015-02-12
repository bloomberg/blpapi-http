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

    if (!apiSession) {
        // If this is a new subscription, create the session.
        if (req.method === 'POST' && req.params.action === 'start') {
            apiSession = new Session(req.blpSession);
            SESSIONSTORE.set(req.clientCert.fingerprint, apiSession);
            req.log.debug('New apisession created.');
        } else {
            // When unsubscribing, return error if no session found.
            req.log.debug('No active apisession found.');
            return next(new restify.BadRequestError('No active apisession found.'));
        }
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
