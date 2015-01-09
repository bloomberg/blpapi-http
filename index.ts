/// <reference path='typings/tsd.d.ts' />

import restify = require('restify');
import Promise = require('bluebird');
import debugMod = require('debug');
import bunyan = require('bunyan');
import BAPI = require('./tslib/blpapi-wrapper');
import apiSession = require('./tslib/api-session');

// Load config
try {
    var conf = require('./lib/config.js');
} catch (err) {
    console.log(err.message);
    process.exit(1);
}

var logger = bunyan.createLogger(conf.loggerOptions);
var session: BAPI.Session;
var sessConnected: boolean = false;

createSession()
.then((): void => {

    // Create server.
    // TODO: Add https.
    var server = restify.createServer({
        name: 'BLPAPI-HTTP',
        log: logger,
        version: '1.0.0',
        acceptable: ['application/json']
    });

    // Setup request logging
    server.pre((req: restify.Request, res: restify.Response, next: restify.Next): any => {
        // Override request content-type so it is not mandatory for client
        req.headers['content-type'] = 'application/json';
        req.log.info({req: req}, 'Request received.');
        return next();
    });
    server.on('after', (req: restify.Request, res: restify.Response, next: restify.Next): any => {
        req.log.info({res: res}, 'Request finished');
    });

    // Middleware
    server.pre(restify.pre.sanitizePath());
    server.use(apiSession.makeHandler());
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.bodyParser(conf.bodyParserOptions));
    server.use(restify.gzipResponse());
    server.use(restify.fullResponse());
    server.use(restify.throttle(conf.throttleOptions));
    server.use(restify.requestLogger());

    // Route
    server.post('/request/:ns/:svName/:reqName', onRequest);

    // Listen
    server.listen(conf.get('port'));
    server.on('error', (err: Error): void => {
        logger.error(err);
        process.exit(1);
    });
    server.on('listening', (): void => {
        logger.info('listening on', conf.get('port') );
    });
    server.on('close', (): void => {
        logger.info('server closed.');
        session.removeAllListeners();
        session.stop()
        .then( (): void => {
            logger.info('session stoped.');
            sessConnected = false;
            this.session = null;
        })
        .catch( (err: Error): void => {
            logger.error(err, 'session.stop error');
        });
    });
})
.catch((err: Error): void => {
    logger.error(err);
    process.exit(1);
});

function createSession (): Promise<any> {
    sessConnected = false;
    var hp = { serverHost: conf.get('api.host'), serverPort: conf.get('api.port') };
    session = new BAPI.Session(hp);

    // In case session terminate unexpectedly, try to reconnect
    session.once('SessionTerminated', createSession);

    return session.start()
    .then((): void => {
        sessConnected = true;
        logger.info('Session connected.');
    }).catch( (err: Error): void => {
        logger.fatal(err, 'error connecting session.');
        // If we can't connect the session, terminate the server
        process.exit(1);
    });
}

function onRequest(req: apiSession.OurRequest,
                   res: apiSession.OurResponse,
                   next: (err?: any) => any): Promise<any> {
    if (!sessConnected) {
        req.log.error('Session not connected.');
        return next(new restify.InternalError('Session not connected'));
    }

    (() : Promise<any> => {
        return (new Promise<any>((resolve : () => void,
                                  reject : (error : any) => void) : void => {
            session.request('//' + req.params.ns + '/' + req.params.svName,
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
        return next(new restify.BadRequestError(err.message));
    });
}
