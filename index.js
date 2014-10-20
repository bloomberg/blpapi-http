"use strict";

var Promise = require("bluebird");

var http = require('http');
var connect = require('connect');
var morgan = require('morgan');
var jsonBodyAsync = Promise.promisify( require('body/json') );
var dispatch = require("dispatch");

var BAPI = require("./lib/blpapi.js");

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
        console.log("already connected");
        res.sendResponse( {connected:1} );
        return;
    }
    // Create a new session
    var session = req.session = {};
    session.blpsess = new BAPI(hp);
    session.blpsess.start( function (err) {
        res.sendResponse( {connected:1} );
    });
}

function onRequest (req, res, next, ns, svName, reqName) {
    var session = req.session;

    if (!session || !session.blpsess) {
        var err = "Not connected";
        next(err);
        return;
    }

    var p = req.method == "GET" ? Promise.resolve( req.parsedQuery.q ) : jsonBodyAsync( req, res );

    p.then( function(body){
        var allData = [];
        var service = "//" + ns + "/" + svName;
        session.blpsess.request( service, reqName, body, function (err, data, last) {
            if (err)
                return res.sendResponse( {error:1} );
            console.log( "last=", last );
            allData.push( data );
            if (last)
                res.sendResponse( allData );
        });
    });
 }

http.createServer(app).listen(3000);
