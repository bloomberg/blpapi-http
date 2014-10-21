var assert = require("assert");

function mangle ( s ) {
  return ':' + s.toString();
}

function demangle ( s ) {
  return s.substring(1);
}

var StrMap = module.exports = function () {
  assert( this instanceof StrMap );
  this._size = 0;
  this._map = {};
}

StrMap.prototype.size = function () {
  return this._size;
}

StrMap.prototype.clear = function () {
  this._size = 0;
  this._map = {};
}

StrMap.prototype.set = function ( key, val ) {
  var mkey = mangle(key);
  if (!(mkey in this._map))
    ++this._size;
  this._map[mkey] = val;
}

StrMap.prototype.get = function ( key ) {
  return this._map[mangle(key)];
}

StrMap.prototype.has = function ( key ) {
  return mangle(key) in this._map;
}

StrMap.prototype.delete = function ( key ) {
  var mkey = mangle(key);
  if (mkey in this._map)
    --this._size;
  delete this._map[mkey];
}

StrMap.prototype.keys = function () {
  var res = [];
  for ( var t in this._map )
    res.push( demangle(t) );
  return res;
}

StrMap.prototype.values = function () {
  var res = [];
  for ( var t in this._map )
    res.push( this._map[t] );
  return res;
}

StrMap.prototype.forEach = function ( callbackFn, thisArg ) {
  for ( var mkey in this._map )
    callbackFn.call( thisArg, this._map[mkey], demangle(mkey), this );
}
