"use strict";

var debug = require("debug")("session:debug");
var warn = require("debug")("session:warn");
var util = require("util");
var StrMap = require("./StrMap.js");
var List = require("./List.js");

function curSeconds ()
{
    return process.hrtime()[0];
}

var SessionStore = module.exports = function (expirationSeconds) {
    this.map = new StrMap();
    this.ipmap = new StrMap();
    this.mru = new List();
    this.expirationSeconds = expirationSeconds;

    setInterval( expireSessions.bind(this), 1000 );
}

function expireSessions ()
{
    var seconds = curSeconds();
    for ( var prev, entry = this.mru.lastEntry();
          !this.mru.atEnd(entry) && seconds - entry.seconds >= this.expirationSeconds;
          entry = prev )
    {
        prev = entry.prev;
        if (!this.forceExpire( entry.key ))
            this._renew( entry ); // prevent expiration for some time
    }
}

SessionStore.prototype._renew = function ( entry )
{
    if (entry != this.mru.next)
        this.mru.addEntryFirst( this.mru.detachEntry( entry ) );
    entry.seconds = curSeconds();
}

SessionStore.prototype.forceExpire = function(key) {
    var entry;
    if (entry = this.map.get(key)) {
        if (!entry.data.expire || entry.data.expire()) {
            this.map.delete(key);
            this.mru.removeEntry(entry);
            debug("Expired session %s", key);
            return true;
        }
        else
            warn("Session %s could not be expired", key );
    }
    return false;
}

SessionStore.prototype.set = function(key,val) {
    var entry;
    if ( (entry = this.map.get(key)) ) {
        this.mru.detachEntry( entry );
        entry.data = val;
    }
    else
        entry = new List.prototype.Entry( val );

    entry.seconds = curSeconds();
    entry.key = key;
    this.map.set( key, this.mru.addEntryFirst( entry ) );
}


SessionStore.prototype.get = function(key) {
    var entry = this.map.get( key );
    if (entry) {
        this._renew( entry );
        return entry.data;
    }
    return undefined;
}
