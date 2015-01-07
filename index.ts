/// <reference path='typings/tsd.d.ts' />

import Promise = require('bluebird');
import debugMod = require('debug');
import assert = require('assert');
import http = require('http');
import morgan = require('morgan');
import BAPI = require('./tslib/blpapi-wrapper');
import apiSession = require('./tslib/api-session');
var connect = require('connect');
var jsonBodyAsync = Promise.promisify( require('body/json') );
var dispatch = require('dispatch');
var versionCheck = require('./lib/versioncheck.js');
var debug = debugMod('bprox:debug');
var info = debugMod('bprox:info');
var error = debugMod('bprox:error');

// Load config
try {
    var conf = require('./lib/config.js');
    /* tslint:disable:whitespace */
    // TODO: Raise issue with tslint on GitHub
} catch(ex) {
    /* tslint:enable:whitespace */
    console.log(ex.message);
    process.exit(1);
}

// Create Session
var session: BAPI.Session;
var sessConnected: boolean = false;

createSession()
.then((): void => {
    // Connect
    var app = connect();
    app.use(morgan('dev'));
    var api1 = connect();
    api1.use( apiSession.makeHandler() );
    api1.use( dispatch({
        '/request/:ns/:service/:request' : onRequest
    }));
    app.use( versionCheck( 1, 0, api1 ) );

    // Http server
    var server = http.createServer(app);
    server.listen(conf.get('port'));
    server.on('error', (ex: Error): void => {
        console.error(ex.message);
        process.exit(1);
    });
    server.on('listening', (): void => {
        console.log('listening on', conf.get('port') );
    });
    server.on('close', (): void => {
        console.log('server closed.');
        var sess = this.session;
        this.session = null;
        sess.stop()
        .then( (): void => {
            debug( 'stopped session' );
            sessConnected = false;
        }).catch( (err: Error): void => {
            error( 'session.stop error', err.message );
        });
    });
})
.catch((err: Error): void => {
    error( err.message );
});

// Create a new session
function createSession (): Promise<any> {
    sessConnected = false;
    var hp = { serverHost: conf.get('api.host'), serverPort: conf.get('api.port') };
    session = new BAPI.Session(hp);

    // In case session terminate unexpectedly, try to reconnect
    session.once('SessionTerminated', createSession);

    return session.start()
    .then((): void => {
        sessConnected = true;
        console.log('Session connected.');
    }).catch( (err: Error): void => {
        debug('error connecting:', err);
        // If we can't connect the session, terminate the server
        process.exit(1);
    });
}

function onRequest(req: apiSession.OurRequest,
                   res: apiSession.OurResponse,
                   next: Function,
                   ns: string,
                   svName: string,
                   reqName: string): Promise<any> {
    if (!sessConnected) {
        return res.sendError( {}, 'Session not connected', {category: 'NO_AUTH'} );
    }
    if (req.method !== 'POST') {
        return res.sendError( {}, req.method + ' is not supported', {category: 'BAD_ARGS'} );
    }

    jsonBodyAsync( req, res )
    .then( (body: any): void => {
        session.request('//' + ns + '/' + svName,
                                reqName,
                                body,
                                (err: Error, data: any, last: boolean): Promise<any> => {
            if (err) {
                debug('request error:', err);
                return res.sendError( err, 'Request error', {category: 'BAD_ARGS'} );
            }
            var p = res.sendChunk( data );
            if (last) {
                p.then(function() {
                    return res.sendEnd( 0, 'OK' );
                });
            }
        });
    }).catch( (err: Error): Promise<any> => {
        return res.sendError( err, 'Request error', {category: 'BAD_ARGS'} );
    });
 }


