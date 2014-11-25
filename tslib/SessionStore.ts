/// <reference path='../typings/tsd.d.ts' />

import debugMod = require('debug');
import util = require('util');
import StrMap = require('./StrMap');
import List = require('./List');

var debug = debugMod('session:debug');
var warn = debugMod('session:warn');

function curSeconds () {
    return process.hrtime()[0];
}

class Entry<T> {
    prev: Entry<T>;
    next: Entry<T>;
    key: any;
    data: T;
    seconds: number;

    constructor(data: T) {
        this.data = data;
    }
}

interface Expirable {
    expire?(): boolean;
}


export = SessionStore;

class SessionStore<T extends Expirable> {

private map = new StrMap<Entry<T>>();
private mru = new List<Entry<T>>();
private expirationSeconds: number;


constructor (expirationSeconds: number) {
    this.expirationSeconds = expirationSeconds;

    setInterval( this.expireSessions.bind(this), 1000 );
}

expireSessions (): void
{
    var seconds = curSeconds();
    for (var prev: Entry<T>, entry = this.mru.last();
         entry && seconds - entry.seconds >= this.expirationSeconds;
         entry = prev)
    /* tslint:disable:one-line */
    // TODO: raise issue with tslint
    {
    /* tslin:enable:one-line */
        prev = entry.prev;
        if (!this.forceExpire( entry.key )) {
            this.renew( entry ); // prevent expiration for some time
        }
    }
}

private renew(entry: Entry<T>): void
{
    if (entry !== this.mru.first()) {
        this.mru.addFirst( this.mru.remove( entry ) );
    }
    entry.seconds = curSeconds();
}

private forceExpire(key: any): boolean {
    var entry: Entry<T>;
    if (entry = this.map.get(key)) {
        if (!entry.data.expire || entry.data.expire()) {
            this.map.delete(key);
            this.mru.remove(entry);
            entry.data = null;
            debug('Expired session %s', key);
            return true;
        } else {
            warn('Session %s could not be expired', key );
        }
    }
    return false;
}

set(key: any, val: T): void {
    var entry: Entry<T>;
    if ( (entry = this.map.get(key)) ) {
        this.mru.remove( entry );
        entry.data = val;
    } else {
        entry = new Entry( val );
    }

    entry.seconds = curSeconds();
    entry.key = key;
    this.map.set( key, this.mru.addFirst( entry ) );
}


get(key: any): T {
    var entry = this.map.get( key );
    if (entry) {
        this.renew( entry );
        return entry.data;
    }
    return undefined;
}

}

