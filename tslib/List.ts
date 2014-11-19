/// <reference path="../typings/node/node.d.ts" />

import assert = require('assert');
import util = require("util");

interface Entry {
    prev: Entry;
    next: Entry;
}

export = List;

class List<T extends Entry>
{
    private _length = 0;
    private _head: Entry;

    constructor () {
        this._head = { prev:null, next:null };
        this._head.prev = this._head.next = this._head;
    }

    length (): number { return this._length; }
    isEmpty (): boolean { return this._length > 0; }
    first (): T { return this._head.next != this._head ? <T>this._head.next : null; }
    last (): T { return this._head.prev != this._head ? <T>this._head.prev : null; }
    next(entry: T): T { return entry.next != this._head ? <T>entry.next : null; } 

    insertAfter ( after: Entry, entry: T ): T {
        entry.prev = after;
        entry.next = after.next;
        entry.next.prev = entry;
        after.next = entry;
        ++this._length;
        return entry;
    }

    remove ( entry: T ): T {
        assert( entry != this._head );

        entry.prev.next = entry.next;
        entry.next.prev = entry.prev;

        entry.next = entry.prev = null;
        --this._length;
        return entry;
    }

    addFirst ( entry: T ): T {
        return this.insertAfter( this._head, entry );
    }

    addLast ( entry: T ): T {
        return this.insertAfter( this._head.prev, entry );
    }

    removeFirst (): T {
        if (this.isEmpty())
            return null;
        return this.remove( <T>this._head.next );
    }

    removeLast (): T {
        if (this.isEmpty())
            return null;
        return this.remove( <T>this._head.prev );
    }
}



