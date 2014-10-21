"use strict";

var Promise = require('bluebird');
var uid = require("uid-safe");
var parseurl = require("parseurl");
var qs = require("qs");

var StrMap = require("./strmap.js");

module.exports = function () {
  var g_store = new StrMap();

  return function handleSession ( req, res, next ) {
    var parsed = parseurl(req);
    var query = qs.parse(parsed.query);

    req.parsedQuery = query;
    res.sendResponse = function ( obj ) {
        var p = Promise.resolve(undefined);
        if (req.session)
            p = Promise.resolve(req.session.sessid || uid(24)).then(function(sessid) {
                g_store.set(sessid, req.session);
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

    var session = query.sessid && g_store.get(query.sessid);
    if (session)
        req.session = session;

    next();
  }
}
