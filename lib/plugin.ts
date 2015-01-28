/// <reference path="../typings/tsd.d.ts" />
import _ = require('lodash');
import restify = require('restify');
import apiSession = require('./api-session');
import conf = require('./config');

export = Plugin;

class Plugin {

    // Custom logging plugin.
    // Log client cert details, request body, etc
    public static log(): (req: apiSession.OurRequest,
                          res: apiSession.OurResponse,
                          next: (err?: any) => any ) => void {

        return function log(req: apiSession.OurRequest,
                            res: apiSession.OurResponse,
                            next: (err?: any) => any ): void {
            // Log request details
            req.log.info({req: req}, 'Request received.');

            // Log client certificate details(only in https mode)
            if (conf.get('logging.clientDetail') && _.has(req, 'clientCert')) {
                req.log.debug({cert: req.clientCert});
            }

            // Log request body
            if (req.body && conf.get('logging.reqBody')) {
                req.log.debug({body: req.body});
            }

            return next();
        };
    }

    // Reject HTTP request for certain route
    public static rejectHTTP(): (req: apiSession.OurRequest,
                                 res: apiSession.OurResponse,
                                 next: (err?: any) => any ) => void {

        return function rejectHTTP(req: apiSession.OurRequest,
                                   res: apiSession.OurResponse,
                                   next: (err?: any) => any ): void {
            // Log client certificate details(only in https mode)
            if (!conf.get('https.enable')) {
                req.log.debug('Invalid request. HTTP request received where HTTPS is expected');
                return next(new restify.BadRequestError(
                    'Invalid request. HTTP request received where HTTPS is expected'));
            }

            return next();
        };
    }
}
