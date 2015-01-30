/// <reference path='typings/tsd.d.ts' />

import restify = require('restify');
import Promise = require('bluebird');
import bunyan = require('bunyan');
import conf = require('./lib/config');
import blpSession = require('./lib/middleware/blp-session');
import requestHandler = require('./lib/middleware/request-handler');
import util = require('./lib/middleware/util');

var logger: bunyan.Logger = bunyan.createLogger(conf.get('loggerOptions'));

// Create server.
var serverOptions = conf.get('serverOptions');
serverOptions.log = logger;     // Setup bunyan logger
var server = restify.createServer(serverOptions);

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
server.use(util.getCert);
server.use(util.log);
server.use(blpSession.getSession);
server.use(requestHandler.elevateRequest);

// Route
server.post('/request/:ns/:svName/:reqName', requestHandler.onRequest);

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
