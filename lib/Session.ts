/// <reference path="../typings/tsd.d.ts" />
import Promise = require('bluebird');
import bunyan = require('bunyan');
import apiSession = require('./api-session');
import BAPI = require('./blpapi-wrapper');
import Subscription = require('./SubscriptionWithBuffer');
import SubscriptionStore = require('./SubscriptionStoreWithBuffer');
import conf = require('./config');

export = Session;

class Session {
    key: string;
    inUse: number = 0;
    blpsess: BAPI.Session;
    activeSubscriptions = new SubscriptionStore();
    receivedSubscriptions = new SubscriptionStore();
    lastPollId: number = undefined;
    lastSuccessPollId: number = undefined;
    logger: bunyan.Logger;
    expired: boolean;

    constructor ( sessKey: string, blpsess: BAPI.Session ) {
        this.key = sessKey;
        this.blpsess = blpsess;
        this.logger = bunyan.createLogger(conf.get('loggerOptions')).child({sessKey: this.key});
        this.expired = false;
    }

    expire(): boolean
    {
        if (this.inUse) {
            return false;
        }

        // unsubscribe all active subscriptions if there's any
        if (this.activeSubscriptions.size) {
            var subscriptions = this.activeSubscriptions.getAll();
            subscriptions.forEach((sub: Subscription): void => {
                sub.removeAllListeners();
                this.receivedSubscriptions.delete(sub);
            });
            this.blpsess.unsubscribe(subscriptions);
            this.activeSubscriptions.clear();
            this.lastPollId = this.lastSuccessPollId = undefined;
            this.logger.debug('Unsubscribed all active subscriptions.');
        }

        this.expired = true;
        this.logger.debug('Session expires.');
        return true;
    }

}
