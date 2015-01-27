/// <reference path='typings/tsd.d.ts' />

import restify = require('restify');
import Promise = require('bluebird');
import bunyan = require('bunyan');
import sio = require('socket.io');
import webSocket = require('ws');
import BAPI = require('./lib/blpapi-wrapper');
import APISess = require('./lib/api-session');
import conf = require('./lib/config');
import plugin = require('./lib/plugin');
import RequestHandler = require('./lib/RequestHandler');
import WebSocketHandler = require('./lib/WebSocketHandler');

var logger: bunyan.Logger = bunyan.createLogger(conf.get('loggerOptions'));
var blpSession: BAPI.Session;

createSession()
.then((): void => {
    var apiSession = new APISess.APISession(blpSession);
    var requestHandler = new RequestHandler(blpSession);
    var webSocketHandler = new WebSocketHandler(blpSession);

    // Create server.
    var serverOptions = conf.get('serverOptions');
    serverOptions.log = logger;     // Setup bunyan logger
    var server = restify.createServer(serverOptions);

    // Override request content-type so it is not mandatory for client
    server.pre(function pre(req: restify.Request, res: restify.Response, next: restify.Next): any {
        req.headers['content-type'] = 'application/json';
        return next();
    });
    server.on('after', (req: restify.Request, res: restify.Response, next: restify.Next): any => {
        req.log.info({res: res}, 'Response sent.');
    });

    // Middleware
    server.pre(restify.pre.sanitizePath());
    server.use(apiSession.handleRequest());
    server.use(restify.acceptParser(server.acceptable));
    server.use(restify.bodyParser(conf.get('bodyParserOptions')));
    server.use(restify.gzipResponse());
    server.use(restify.fullResponse());
    server.use(restify.throttle(conf.get('throttleOptions')));
    server.use(restify.requestLogger());
    server.use(restify.queryParser());
    server.use(plugin.log());

    // Route
    server.post('/request/:ns/:svName/:reqName', requestHandler.onRequest());
    server.post('/subscribe', plugin.rejectHTTP(),
                              apiSession.createSession(),
                              apiSession.handleSession(),
                              requestHandler.onSubscribe());
    server.get('/poll', plugin.rejectHTTP(),
                        apiSession.handleSession(),
                        requestHandler.onPoll());
    server.get('/unsubscribe', plugin.rejectHTTP(),
                               apiSession.handleSession(),
                               requestHandler.onUnsubscribe());
    server.post('/unsubscribe', plugin.rejectHTTP(),
                                apiSession.handleSession(),
                                requestHandler.onUnsubscribe());

    // Listen
    server.listen(conf.get('port'));
    server.on('error', (err: Error): void => {
        logger.error(err);
        process.exit(1);
    });
    server.on('listening', (): void => {
        logger.info('http server listening on', conf.get('port') );
    });
    server.on('close', (): void => {
        logger.info('server closed.');
        blpSession.removeAllListeners();
        blpSession.stop()
        .then( (): void => {
            logger.info('blpSession stoped.');
            this.session = null;
        })
        .catch( (err: Error): void => {
            logger.error(err, 'blpSession.stop error');
        });
    });

    // Socket.IO
    if (conf.get('webSocket.socket-io.enable')) {
        // Socket.IO will only work in HTTPS mode
        if (!conf.get('https.enable')) {
            throw new Error('can not enable socket-io on http mode.');
        }

        var serverSio: any = restify.createServer(conf.get('serverOptions'));
        serverSio.listen(conf.get('webSocket.socket-io.port'));
        serverSio.on('listening', (): void => {
            logger.info('socket.io server listening on', conf.get('webSocket.socket-io.port') );
        });
        var io: SocketIO.Namespace = sio(serverSio.server).of('/subscription');
        io.on('connection', webSocketHandler.onConnect_sio());
    }

    // ws
    if (conf.get('webSocket.ws.enable')) {
        // ws will only work in HTTPS mode
        if (!conf.get('https.enable')) {
            throw new Error('can not enable ws on http mode.');
        }

        var serverWS: any = restify.createServer(conf.get('serverOptions'));
        serverWS.listen(conf.get('webSocket.ws.port'));
        serverWS.on('listening', (): void => {
            logger.info('ws server listening on', conf.get('webSocket.ws.port') );
        });
        var wss = new webSocket.Server({server: serverWS.server});
        wss.on('connection', webSocketHandler.onConnect_ws());
    }

})
.catch((err: Error): void => {
    logger.error(err);
    process.exit(1);
});

function createSession (): Promise<any> {
    blpSession = new BAPI.Session(conf.get('sessionOptions'));

    // In case blpSession terminate unexpectedly, try to reconnect
    blpSession.once('SessionTerminated', createSession);

    return blpSession.start()
    .then((): void => {
        logger.info('BLPAPI Session connected.');
    }).catch( (err: Error): void => {
        logger.fatal(err, 'error connecting blpSession.');
        // If we can't connect the blpSession, terminate the server
        process.exit(1);
    });
}
