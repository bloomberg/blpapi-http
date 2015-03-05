/// <reference path='../../typings/tsd.d.ts' />

// Handles client auth operations.
// Currently we only have authorization (e.g. Identity management), associating the identities with
// client certs.

import blpapi = require('blpapi');
import _ = require('lodash');
import restify = require('restify');
import Interface = require('../interface');
import Map = require('../util/map');

var sIdentityMap: Map<blpapi.Identity> = new Map<blpapi.Identity>();

export function getIdentity(req: Interface.IOurRequest,
                            res: Interface.IOurResponse,
                            next: restify.Next): void
{
    if (_.has(req, 'clientCert')) {
        req.identity = sIdentityMap.get(req.clientCert.fingerprint) || null;
    } else {
        req.identity = null;
    }
    return next();
}

export function setIdentity(req: Interface.IOurRequest, identity: blpapi.Identity): void
{
    if (!_.has(req, 'clientCert')) {
        throw new Error('Cannot setIdentity without a client cert');
    }
    sIdentityMap.set(req.clientCert.fingerprint, identity);
}
