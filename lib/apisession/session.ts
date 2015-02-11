/// <reference path='../../typings/tsd.d.ts' />

import bunyan = require('bunyan');
import BAPI = require('../blpapi-wrapper');
import Subscription = require('../subscription/subscription');
import Map = require('../util/map');
import conf = require('../config');

function curSeconds(): number
{
    return process.hrtime()[0];
}

export = Session;

class Session {
    // PRIVATE VARIABLES
    private _blpsess: BAPI.Session;
    private _logger: bunyan.Logger;
    private _seconds: number; // Last checked activity timestamp
    private _expired: boolean = false;
    private _activeSubscriptions: Map<Subscription> = new Map<Subscription>();
    private _receivedSubscriptions: Map<Subscription> = new Map<Subscription>();

    // PUBLIC VARIABLES
    public inUse: number = 0;
    public lastPollId: number = null;
    public lastSuccessPollId: number = null;

    // PRIVATE FUNCTIONS
    private clear(): void {
        this._receivedSubscriptions.forEach((sub: Subscription): boolean => {
            sub.removeAllListeners();
            return true;
        });
        this._activeSubscriptions.clear();
        this._receivedSubscriptions.clear();
        this.lastPollId = this.lastSuccessPollId = null;
    }

    // CONSTRUCTOR
    constructor(blpsess: BAPI.Session) {
        this._blpsess = blpsess;
        this._logger = bunyan.createLogger(conf.get('loggerOptions'));
        this._seconds = curSeconds();  // Record the creation time

        // Tear down the current session when the underlying blpSession terminated unexpectedly
        this._blpsess.once('SessionTerminated', (): void => {
            if (!this._expired) {
                this._logger.debug('blpSession terminated unexpectedly. Terminate session.');
                this.clear();
            }
        });
    }

    // PROPERTIES
    get seconds(): number {
        return this._seconds;
    }

    get expired(): boolean {
        return this._expired;
    }

    get activeSubscriptions(): Map<Subscription> {
        return this._activeSubscriptions;
    }

    get receivedSubscriptions(): Map<Subscription> {
        return this._receivedSubscriptions;
    }

    // PUBLIC FUNCTIONS
    expire(): boolean {
        if (!this.isExpirable()) {
            return false;
        }

        // unsubscribe all active subscriptions when session expires
        if (this._activeSubscriptions.size) {
            try {
                this._blpsess.unsubscribe(this._activeSubscriptions.values());
            } catch (err) {
                this._logger.error(err, 'Error Unsubscribing');
            }
            this._logger.debug('Unsubscribed all active subscriptions.');
        }
        this.clear();
        this._expired = true;
        this._logger.debug('Session expires.');
        return true;
    }

    renew(): void {
        this._seconds = curSeconds();  // Record the renewed time
    }

    isExpirable(): boolean {
        return !this.inUse;
    }
}
