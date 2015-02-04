/// <reference path='../../typings/tsd.d.ts' />

import Session = require('./session');
import Map = require('../util/map');

export = SessionStore;

class SessionStore {
    // PRIVATE VARIABLES
    private _expirationSeconds: number;
    private _map: Map<Session> = new Map<Session>();

    // PRIVATE RUNCTIONS
    private expireSessions(): void {
        var curSecond = process.hrtime()[0];
        this._map.forEach((sess: Session, key: string): boolean => {
            // If the session is not expirable, renew the time stamp
            if (!sess.isExpirable()) {
                sess.renew();
                return true;
            }
            // If the current session already exist longer than the expirationSeconds,
            // then expire it and remove it from store
            if (curSecond - sess.seconds >= this._expirationSeconds) {
                sess.expire();
                this._map.delete(key);
            }
            return true;
        });
    }

    // CONSTRUCTOR
    constructor(expirationSeconds: number, checkFrequency: number = 1000) {
        this._expirationSeconds = expirationSeconds;
        setInterval(this.expireSessions.bind(this), checkFrequency);
    }

    // PUBLIC FUNCTION
    set(key: string, sess: Session): void {
        this._map.set(key, sess);
    }

    get(key: string): Session {
        return this._map.get(key);
    }
}
