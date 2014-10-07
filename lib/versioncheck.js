"use strict";

module.exports = function ( verMajor, verMinor, app ) {
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
