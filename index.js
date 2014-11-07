"use strict";

var Promise = require("bluebird");
var debugMod = require("debug");

var http = require('http');
var connect = require('connect');
var morgan = require('morgan');
var jsonBodyAsync = Promise.promisify( require('body/json') );
var dispatch = require("dispatch");

var BAPI = require("./lib/blpapi-wrapper.js");

var versionCheck = require("./lib/versioncheck.js");
var apiSession = require("./lib/api-session.js");

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
api1.use( apiSession() );
api1.use( dispatch({
    "/connect": onConnect,
    "/request/:ns/:service/:request" : onRequest
}));

app.use( versionCheck( 1, 0, api1 ) );

var hp = { serverHost: conf.get('api.host'), serverPort: conf.get('api.port') };

function onConnect (req, res, next) {
    if (req.session && session.blpsess) {
        debug("already connected");
        res.sendEnd( 0, "Already connected" );
        return;
    }
    // Create a new session
    var blpsess = new BAPI(hp);
    blpsess.start().then( function (){
        req.session = { blpsess : blpsess };
        res.sendEnd( 0, "Connected" );
    }).catch( function(err) {
        debug("error connecting:", err);
        res.sendError( err, "Error connecting" );
    });
}

function onRequest (req, res, next, ns, svName, reqName) {
    var session = req.session;

    if (!session || !session.blpsess) {
        return res.sendError( {}, "Not connected", {category:"NO_AUTH"} );
    }

    var p = req.method == "GET" ? Promise.resolve( req.parsedQuery.q ) : jsonBodyAsync( req, res );

    p.then( function(body){
        session.blpsess.request( "//" + ns + "/" + svName, reqName, body, function (err, data, last) {
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
 server.on('error', function (ex) {
     console.error(ex.message);
     process.exit(1);
 });

 server.listen(conf.get('port'));
 server.on('listening', function() {
     console.log('listening on', conf.get('port') );
 });
