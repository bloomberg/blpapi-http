"use strict";

var Promise = require("bluebird");
var debug = require("debug")("bprox");

var http = require('http');
var connect = require('connect');
var morgan = require('morgan');
var jsonBodyAsync = Promise.promisify( require('body/json') );
var dispatch = require("dispatch");

var BAPI = require("./lib/blpapi-wrapper.js");

var versionCheck = require("./lib/versioncheck.js");
var apiSession = require("./lib/api-session.js");

var app = connect();

app.use(morgan('combined'));

var api1 = connect();
api1.use( apiSession() );
api1.use( dispatch({
    "/connect": onConnect,
    "/request/:ns/:service/:request" : onRequest
}));

app.use( versionCheck( 1, 0, api1 ) );

var hp = { serverHost: '127.0.0.1', serverPort: 8194 };

function onConnect (req, res, next) {
    if (req.session && session.blpsess) {
        debug("already connected");
        res.sendEnd( 200, "Already connected" );
        return;
    }
    // Create a new session
    var blpsess = new BAPI(hp);
    blpsess.start().then( function (){
        req.session = { blpsess : blpsess };
        res.sendEnd( 200, "Connected" );
    }).catch( function(err) {
        res.sendEnd( 500, "Error connecting" );
    });
}

function onRequest (req, res, next, ns, svName, reqName) {
    var session = req.session;

    if (!session || !session.blpsess) {
        return res.sendEnd( 401, "Not connected" );
    }

    var p = req.method == "GET" ? Promise.resolve( req.parsedQuery.q ) : jsonBodyAsync( req, res );

    p.then( function(body){
        session.blpsess.request( "//" + ns + "/" + svName, reqName, body, function (err, data, last) {
            if (err)
                return res.sendEnd( 500, "error" );
            var p = res.sendChunk( data );
            if (last) {
                p.then(function(){
                    res.sendEnd( 200, "OK" );
                });
            }
        });
    });
 }

http.createServer(app).listen(3000);
