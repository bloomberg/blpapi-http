"use strict";

var Promise = require("bluebird");

var http = require('http');
var connect = require('connect');
var morgan = require('morgan');
var jsonBodyAsync = Promise.promisify( require('body/json') );
var dispatch = require("dispatch");
var parseurl = require("parseurl");
var qs = require("qs");
var uid = require("uid-safe");


var BAPI = require("./lib/blpapi.js");

var app = connect();

app.use(morgan('combined'));

function versionCheck ( verMajor, verMinor, app ) {
    return function ( req, res, next ) {
        var re = /^\/v(\d+)\.(\d+)\//;
        var match = re.exec(req.url);
        if (match && parseInt(match[1]) == verMajor && parseInt(match[2]) >= verMinor) {
            req.originalUrl = req.originalUrl || req.url;
            req.url = req.url.substr( match[0].length-1); // remove the version prefix
            return app(req, res, next);
        }
        else
            return next();
    };
}

var api1 = connect();
api1.use( handleSession );
api1.use( dispatch({
    "/connect": onConnect,
    "/request/:ns/:service/:request" : onRequest
}));

app.use( versionCheck( 1, 0, api1 ) );

var g_store = {};

function handleSession ( req, res, next ) {
    var parsed = parseurl(req);
    var query = qs.parse(parsed.query);

    req.parsedQuery = query;
    res.sendResponse = function ( obj ) {
        var p = Promise.resolve(undefined);
        if (req.session)
            p = Promise.resolve(req.session.sessid || uid(24)).then(function(sessid) {
                g_store[':'+sessid] = req.session;
                obj.sessid = sessid;
            });
        p.then(function(){
            var json = JSON.stringify(obj);
            var str;
            if (query.callback) {
                str = query.callback + "(" + json + ");";
                res.setHeader("content-type", "text/javascript");
            }
            else {
                str = json;
                res.setHeader("content-type", "application/json");
            }
            res.end(str);
        });
    };

    var session = query.sessid && g_store[':'+query.sessid];
    if (session)
        req.session = session;

    next();
}

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
