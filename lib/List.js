"use strict";

var assert = require("assert");
var util = require("util");

function Entry (data)
{
    this.prev = this.next = this;
    this.data = data;
}

var List = module.exports = function ()
{
    assert( this instanceof List );
    Entry.call( this );
    this.length = 0;
}
util.inherits(List,Entry);


List.prototype.Entry = Entry;

List.prototype.isEmpty = function ()
{
    return this.prev == this;
}

List.prototype.getLength = function ()
{
    return this.length;
}

List.prototype.firstEntry = function ()
{
    return this.next;
}

List.prototype.lastEntry = function ()
{
    return this.prev;
}

List.prototype.atEnd = function ( entry )
{
    return entry == this;
}

List.prototype.insertEntryAfter = function ( after, entry )
{
    assert( (entry instanceof Entry) );
    entry.prev = after;
    entry.next = after.next;
    entry.next.prev = entry;
    after.next = entry;
    ++this.length;
    return entry;
}

List.prototype.insertAfter = function ( after, data )
{
    assert( !(data instanceof Entry) );
    return this.insertEntryAfter( after, new Entry( data ) );
}

List.prototype.detachEntry = function ( entry )
{
    assert( entry instanceof Entry );
    assert( entry != this );

    entry.prev.next = entry.next;
    entry.next.prev = entry.prev;

    entry.next = entry.prev = undefined;
    --this.length;
    return entry;
}

List.prototype.removeEntry = function ( entry )
{
    this.detachEntry( entry );
    var data = entry.data;
    entry.data = undefined;
    return data;
}

List.prototype.addFirst = function ( data )
{
    return this.insertAfter( this, data );
}
List.prototype.addEntryFirst = function ( entry )
{
    return this.insertEntryAfter( this, entry );
}

List.prototype.addLast = function ( data )
{
    return this.insertAfter( this.prev, data );
}
List.prototype.addEntryLast = function ( entry )
{
    return this.insertEntryAfter( this.prev, entry );
}

List.prototype.removeFirst = function ()
{
    if (this.isEmpty())
        return undefined;
    return this.removeEntry( this.next );
}

List.prototype.removeLast = function ()
{
    if (this.isEmpty())
        return undefined;
    return this.removeEntry( this.prev );
}


List.prototype.detachFirst = function ()
{
    if (this.isEmpty())
        return undefined;
    return this.detachEntry( this.next );
}

List.prototype.detachLast = function ()
{
    if (this.isEmpty())
        return undefined;
    return this.detachEntry( this.prev );
}
