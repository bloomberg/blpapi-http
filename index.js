"use strict";

//var assert = require("assert");
//var util = require("util");
var http = require('http');
var connect = require('connect');
var morgan = require('morgan');
var jsonBody = require('body/json');
//var session = require("express-session");
var dispatch = require("dispatch");
var parseurl = require("parseurl");
var qs = require("qs");
var uid = require("uid-safe").sync;

var blpapi = require('blpapi');

var Store = require("./lib/store.js");

var hp = { serverHost: '127.0.0.1', serverPort: 8194 };

var app = connect();

var serviceRefdata = 0;

app.use(morgan('combined'));

app.use( handleSession );

app.use( dispatch({
    "/v1.(\\d+)/connect": onConnectV1,
    "POST /v1.(\\d+)/request/:ns/:service/:request" : onRequestV1,
    "GET /v1.(\\d+)/request/:ns/:service/:request" : onRequestGet
}));

var V1_MINOR = 0;

var g_store = {};

function handleSession ( req, res, next ) {
    var parsed = parseurl(req);
    var query = qs.parse(parsed.query);

    req.parsedQuery = query;
    res.sendResponse = function ( obj ) {
        if (req.session) {
            var sessid = req.session.sessid || uid(24);
            g_store[':'+sessid] = req.session;
            obj.sessid = sessid;
        }
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
    };

    var session = query.sessid && g_store[':'+query.sessid];
    if (session)
        req.session = session;

    next();
}

function onConnectV1 (req, res, next, ver) {
    if (!(parseInt(ver) <= V1_MINOR)) {
        next();
        return;
    }

    if (req.session && session.blpsess) {
        console.log("already connected");
        res.sendResponse( {connected:1} );
        return;
    }
    // Create a new session
    var session = req.session = {};
    session.services = {};
    session.blpsess = new blpapi.Session({ serverHost: hp.serverHost,
        serverPort: hp.serverPort });


    session.blpsess.on('SessionStarted', function(m) {
        console.log(m);
        res.sendResponse( {connected:1} );
    });

    session.blpsess.start();
}

function onRequestV1 (req, res, next, ver, ns, svName, reqName) {
    if (!(parseInt(ver) <= V1_MINOR)) {
        next();
        return;
    }
    var session = req.session;

    if (!session || !session.blpsess) {
        var err = "Not connected";
        next(err);
        return;
    }

    var service = "//" + ns + "/" + svName;
    var ref = serviceRefdata++;
    var check = function () {
        if (!(service in session.services)) {
            console.log("Opening service", service);
            session.blpsess.openService(service, ref);
            session.blpsess.once('ServiceOpened', function (m) {
                console.log(m);
                if (m.correlations[0].value == ref) {
                    session.services[service] = "open";
                    opened();
                }
            });
        }
        else {
            console.log("Using cached service", service);
            opened();
        }
    };

    var opened = function () {
        jsonBody( req, res, function (err, body) {
            if (err) {
                console.log("ERRROR!", err );
                next(err);
                return;
            }

            console.log(JSON.stringify(body));

            var ref = serviceRefdata++;

            session.blpsess.request(service, reqName + "Request", body, ref );
            session.blpsess.once(reqName + "Response", function(m) {
                res.sendResponse(m);
            })
        });
    };

    check();

}

function onRequestGet (req, res, next, ver, ns, svName, reqName) {
    if (!(parseInt(ver) <= V1_MINOR)) {
        next();
        return;
    }
    var session = req.session;

    if (!session || !session.blpsess) {
        var err = "Not connected";
        next(err);
        return;
    }

    var service = "//" + ns + "/" + svName;
    var ref = serviceRefdata++;
    var check = function () {
        if (!(service in session.services)) {
            console.log("Opening service", service);
            session.blpsess.openService(service, ref);
            session.blpsess.once('ServiceOpened', function (m) {
                console.log(m);
                if (m.correlations[0].value == ref) {
                    session.services[service] = "open";
                    opened();
                }
            });
        }
        else {
            console.log("Using cached service", service);
            opened();
        }
    };

    var opened = function () {
        var body = req.parsedQuery.q;
        console.log(JSON.stringify(body));

        var ref = serviceRefdata++;

        session.blpsess.request(service, reqName + "Request", body, ref );
        session.blpsess.once(reqName + "Response", function(m) {
            res.sendResponse(m);
        })
    };

    check();

}

http.createServer(app).listen(3000);
