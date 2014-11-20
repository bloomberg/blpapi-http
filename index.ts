/// <reference path="typings/tsd.d.ts" />

import Promise = require("bluebird");
import debugMod = require("debug");

import assert = require("assert");
import http = require('http');
var connect = require('connect');
import morgan = require('morgan');
var jsonBodyAsync = Promise.promisify( require('body/json') );
var dispatch = require("dispatch");

import BAPI = require("./tslib/blpapi-wrapper");

var versionCheck = require("./lib/versioncheck.js");
import apiSession = require("./tslib/api-session");

var debug = debugMod("bprox:debug");
var info = debugMod("bprox:info");
var error = debugMod("bprox:error");

try {
    var conf = require('./lib/config.js');
} catch(ex) {
    console.log(ex.message);
    process.exit(1);
}
var app = connect();

app.use(morgan('combined'));

var api1 = connect();
api1.use( apiSession.makeHandler() );
api1.use( dispatch({
    "/connect": onConnect,
    "/request/:ns/:service/:request" : onRequest
}));

app.use( versionCheck( 1, 0, api1 ) );

var hp = { serverHost: conf.get('api.host'), serverPort: conf.get('api.port') };

class Session
{
    inUse: number = 0;

    constructor ( req: apiSession.OurRequest, public blpsess: BAPI.Session )
    {
        debug( "Created new session for client", req.clientIp );
    }

    expire(): boolean
    {
        if (this.inUse)
            return false;

        if (this.blpsess){
            var blpsess = this.blpsess;
            this.blpsess = null;
            blpsess.stop().then( function(){
                debug( "stopped blpsess" );
            }).catch( function(err: Error) {
                error( "blpsess.stop error", err.message );
            });
        }
        return true;
    }
}


function onConnect (req: apiSession.OurRequest, res: apiSession.OurResponse, next: Function): void {
    if (req.session && req.session.blpsess) {
        debug("already connected");
        res.sendEnd( 0, "Already connected" );
        return;
    }
    // Create a new session
    var blpsess = new BAPI.Session(hp);
    blpsess.start().then( function (): Promise<any> {
        req.session = new Session(req, blpsess);
        return res.sendEnd( 0, "Connected" );
    }).catch( function(err: Error) {
        debug("error connecting:", err);
        return res.sendError( err, "Error connecting" );
    });
}

function onRequest (
  req: apiSession.OurRequest, res: apiSession.OurResponse, next: Function,
  ns: string, svName: string, reqName: string
)
{
    var session: Session = req.session;

    if (!session || !session.blpsess) {
        return res.sendError( {}, "Not connected", {category:"NO_AUTH"} );
    }

    var p: Promise<any> = req.method == "GET" ? Promise.resolve( req.parsedQuery.q ) : jsonBodyAsync( req, res );

    p.then( function(body: any){
        session.blpsess.request( "//" + ns + "/" + svName, reqName, body, function (err: Error, data: any, last: boolean) {
            if (err){
                debug("request error:", err);
                return res.sendError( err, "Request error", {category:"BAD_ARGS"} );
            }
            var p = res.sendChunk( data );
            if (last) {
                p.then(function(){
                    return res.sendEnd( 0, "OK" );
                });
            }
        });
    }).catch( function(err) {
        return res.sendError( err, "Request error", {category:"BAD_ARGS"} );
    });
 }

 var server = http.createServer(app);
 server.on('error', function (ex: Error) {
     console.error(ex.message);
     process.exit(1);
 });

 server.listen(conf.get('port'));
 server.on('listening', function() {
     console.log('listening on', conf.get('port') );
 });
