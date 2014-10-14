"use strict";

var assert = require("assert");
var util = require("util");
var http = require('http');
var connect = require('connect');
var morgan = require('morgan');
var jsonBody = require('body/json');
var session = require("express-session");
var dispatch = require("dispatch");

var blpapi = require('blpapi');

var Store = require("./lib/store.js");

var hp = { serverHost: '127.0.0.1', serverPort: 8194 };

var app = connect();

var serviceRefdata = 0;

app.use(morgan('combined'));
app.use(session({
    secret: 'blumberg',
    resave: true,
    saveUninitialized: true,
    store: new Store()
}));


app.use( dispatch({
    "POST /v1.(\\d+)/connect": onConnectV1,
    "POST /v1.(\\d+)/request/:ns/:service/:request" : onRequestV1
}));

var V1_MINOR = 0;

function onConnectV1 (req, res, next, ver) {
    if (!(parseInt(ver) <= V1_MINOR)) {
        next();
        return;
    }

    var session = req.session;
    if (session.blpsess) {
        console.log("already connected");
        res.end("connected");
        return;
    }
    session.services = {};
    session.blpsess = new blpapi.Session({ serverHost: hp.serverHost,
        serverPort: hp.serverPort });


    session.blpsess.on('SessionStarted', function(m) {
        console.log(m);
        res.end("connected");
    });

    session.blpsess.start();
}

function onRequestV1 (req, res, next, ver, ns, svName, reqName) {
    if (!(parseInt(ver) <= V1_MINOR)) {
        next();
        return;
    }
    var session = req.session;

    if (!session.blpsess) {
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
                res.setHeader("content-type", "application/json");
                res.end(JSON.stringify(m));
            })
        });
    };

    check();

}


http.createServer(app).listen(3000);
