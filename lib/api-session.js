"use strict";

var assert = require("assert")

var Promise = require('bluebird');
var uid = require("uid-safe");
var parseurl = require("parseurl");
var qs = require("qs");
var ipware = require("ipware")();

var config = require("./config.js");
var SessionStore = require("./SessionStore.js");

function stringifyPair ( key, value ) {
    return "\"" + key.replace(/"/g, "\\$&") + "\":" + JSON.stringify(value);
}

module.exports = function () {
    var g_store = new SessionStore(config.get('expiration'));

    return function handleSession ( req, res, next ) {
        var parsed = parseurl(req);
        var parsedQuery = qs.parse(parsed.query);

        var chunkIndex = 0;
        var useJsonp = !!parsedQuery.jpcb;
        var chunk; // the current chunk string is assembled here
        var needComma = false; // need to append a ',' before adding more data

        var pendingPromise = null;

        req.parsedQuery = parsedQuery;

        // returns a promise
        function prepareSession () {
            var resultP = undefined;
            // Before sending the first chunk we must take care of the session id and set the content
            // type
            if (++chunkIndex == 1) {
                res.setHeader("content-type", parsedQuery.callback ? "text/javascript" :
                                                                     "application/json");

                chunk = useJsonp ? parsedQuery.jpcb + "({" : "{";
                needComma = false;

                // if the request has an associated session, make sure it has an id, generating one if
                // needed, and store it in the session store.
                if (req.session) {
                    resultP = Promise.resolve(req.session.sessid || uid(24)).then(function(sessid) {
                        req.session.sessid = sessid;
                        g_store.set(sessid, req.session);
                        chunk += stringifyPair( "sessid", req.session.sessid );
                        needComma = true;
                    });
                }
            }
            else
                chunk = "";

            return resultP || Promise.resolve(undefined);
        };

        res.sendChunk = function ( data ) {
            var p = prepareSession();
            return p.then(function(){
                if (chunkIndex == 1) {
                    res.statusCode = 200;
                    if (needComma)
                        chunk += ",";
                    chunk += '"data":[';
                    needComma = false;
                }
                if (needComma)
                    chunk += ",";
                res.write( chunk + JSON.stringify(data) );
                needComma = true;
            });
        };

        res.sendEnd = function(status, message) {
            var p = prepareSession();
            return p.then(function(){
                // If this is the only chunk, we can set the http status
                if (chunkIndex == 1)
                    res.statusCode = 200;
                else {
                    chunk += "]";
                    needComma = true;
                }
                if (needComma)
                    chunk += ",";
                chunk += stringifyPair( "status", status ) + "," +
                         stringifyPair( "message", message || "" ) +
                         "}";
                if (useJsonp)
                    chunk += ")";
                res.end( chunk );
                needComma = false;
                chunk = "";
            });
        };

        res.sendError = function(err,where,reason) {
            var status;
            var r = err.data && err.data.reason;
            if (r)
                status = { source:r.source, category:r.category, errorCode:r.errorCode };
            else if (reason)
                status = { source:"BProx", category:reason.category, errorCode:-1 };
            else
                status = { source:"BProx", category:"UNCLASSIFIED", errorCode:-1 };
            res.sendEnd( status, err.message || where );
        }

        // Monkey-patch response.end() to track the lifetime of the response
        var savedEnd = res.end;
        res.end = function( data, encoding ) {
            savedEnd.call( res, data, encoding );
            if (session)
                --session.inUse;
        }

        ipware.get_ip(req); // sets req.clientIp and req.clientIpRoutable

        // If a session was specified in the query, try to load it
        var session = parsedQuery.sessid && g_store.get(parsedQuery.sessid);
        if (session) {
            ++session.inUse;
            req.session = session;
        }

        return next();
    }
};
