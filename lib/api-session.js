"use strict";

var assert = require("assert")

var Promise = require('bluebird');
var uid = require("uid-safe");
var parseurl = require("parseurl");
var qs = require("qs");

var StrMap = require("./StrMap.js");

function stringifyPair ( key, value ) {
    return "\"" + key.replace(/"/g, "\\$&") + "\":" + JSON.stringify(value);
}

module.exports = function () {
    var g_store = new StrMap();

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

                chunk = useJsonp ? parsedQuery.jscb + "({" : "{";
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

        res.sendEnd = function(status, message, httpStatus) {
            var p = prepareSession();
            return p.then(function(){
                // If this is the only chunk, we can set the http status
                if (chunkIndex == 1)
                    res.statusCode = httpStatus || 200;
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

        // If a session was specified in the query, try to load it
        var session = parsedQuery.sessid && g_store.get(parsedQuery.sessid);
        if (session)
            req.session = session;

        next();
    }
};
