/// <reference path='typings/tsd.d.ts' />

import restify = require('restify');
import Promise = require('bluebird');
import bunyan = require('bunyan');
import conf = require('./lib/config');
import blpSession = require('./lib/middleware/blp-session');
import requestHandler = require('./lib/middleware/request-handler');
import util = require('./lib/middleware/util');
import sio = require('socket.io');
import webSocket = require('ws');
import webSocketHandler = require('./lib/websocket/websocket-handler');
import apiSession = require('./lib/middleware/api-session');

var logger: bunyan.Logger = bunyan.createLogger(conf.get('loggerOptions'));

// Create server.
var serverOptions = conf.get('serverOptions');
serverOptions.log = logger;     // Setup bunyan logger
var server: restify.Server = restify.createServer(serverOptions);

// Middleware
server.pre(util.resetContentType);
server.pre(restify.pre.sanitizePath());
server.pre(requestHandler.verifyContentType);
server.use(restify.acceptParser(server.acceptable));
server.use(restify.bodyParser(conf.get('bodyParserOptions')));
server.use(restify.gzipResponse());
server.use(restify.fullResponse());
server.use(restify.throttle(conf.get('throttleOptions')));
server.use(restify.requestLogger());
server.use(restify.queryParser());
server.use(util.getCert);
server.use(util.log);
server.use(blpSession.getSession);
server.use(requestHandler.elevateRequest);

// Route
server.post('/request/:ns/:svName/:reqName',
            requestHandler.onRequest);
server.post('/subscribe',
            util.rejectHTTP,
            apiSession.createSession,
            apiSession.handleSession,
            requestHandler.onSubscribe);
server.post('/unsubscribe',
            util.rejectHTTP,
            apiSession.handleSession,
            requestHandler.onUnsubscribe);
server.get('/poll',
           util.rejectHTTP,
           apiSession.handleSession,
           requestHandler.onPoll);

// Listen
server.listen(conf.get('port'));
server.on('error', (err: Error): void => {
    logger.error(err);
    process.exit(1);
});
server.on('listening', (): void => {
    logger.info('http server listening on', conf.get('port') );
});
server.on('after', util.after);

// Socket.IO
if (conf.get('websocket.socket-io.enable')) {
    var serverSio: restify.Server = restify.createServer(conf.get('serverOptions'));
    serverSio.listen(conf.get('websocket.socket-io.port'));
    serverSio.on('listening', (): void => {
        logger.info('socket.io server listening on', conf.get('websocket.socket-io.port') );
    });
    var io: SocketIO.Namespace = sio(serverSio.server).of('/subscription');
    io.on('connection', webSocketHandler.sioOnConnect);
}

// ws
if (conf.get('websocket.ws.enable')) {
    var serverWS: restify.Server = restify.createServer(conf.get('serverOptions'));
    serverWS.listen(conf.get('websocket.ws.port'));
    serverWS.on('listening', (): void => {
        logger.info('ws server listening on', conf.get('websocket.ws.port') );
    });
    var wss = new webSocket.Server({ server: serverWS.server });
    wss.on('connection', webSocketHandler.wsOnConnect);
}
