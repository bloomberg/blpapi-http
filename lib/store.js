var assert = require("assert");
var util = require("util");
var session = require("express-session");

var Store = function () {
    var self = this;
    session.Store.call(this);
    self.map = {}
};

util.inherits( Store, session.Store );

Store.prototype.get = function ( sid, callback ) {
    assert( this instanceof Store );
    var self = this;
    setImmediate( callback, null, self.map[sid] );
};

Store.prototype.set = function ( sid, session, callback ) {
    assert( this instanceof Store );
    var self = this;
    self.map[sid] = session;
    if (callback)
        setImmediate( callback, null );
};

Store.prototype.destroy = function ( sid, callback ) {
    assert( this instanceof Store );
    var self = this;
    delete self.map[sid];
    if (callback)
        setImmediate( callback, null );
};

Store.prototype.length = function ( callback ) {
    assert( this instanceof Store );
    var self = this;
    setImmediate( callback, null, Object.keys(self.map).length)
};

Store.prototype.clear = function ( callback ) {
    assert( this instanceof Store );
    var self = this;
    self.map = {}
};

module.exports = Store;
