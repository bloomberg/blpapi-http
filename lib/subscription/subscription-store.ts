/// <reference path='../../typings/tsd.d.ts' />

import _ = require('lodash');
import Subscription = require('./subscription');

export = SubscriptionStore;

class SubscriptionStore<T extends Subscription> {

    protected subscriptions: {[key: number]: T} = {};

    get size(): number {
        return _.keys(this.subscriptions).length;
    }

    get(cid: number): T {
        return this.has(cid) ? this.subscriptions[cid] : undefined;
    }

    getAll(): T[] {
        return _.values(this.subscriptions);
    }

    add(subscription: T): boolean {
        if (this.has(subscription.correlationId)) {
            return false;
        }
        this.subscriptions[subscription.correlationId] = subscription;
        return true;
    }

    has(value: number): boolean;
    has(value: T): boolean;
    has(value: any): boolean {
        if (typeof value === 'number') {
            return _.has(this.subscriptions, value);
        }
        else if (typeof value === 'object') {
            return _.has(this.subscriptions, value.correlationId);
        }
        return false;
    }

    delete(value: number): boolean;
    delete(value: T): boolean;
    delete(value: any): boolean {
        if (typeof value === 'number') {
            if (!this.has(value)) {
                return false;
            }
            delete this.subscriptions[value];
            return true;
        }
        else if (typeof value === 'object') {
            if (!this.has(value)) {
                return false;
            }
            delete this.subscriptions[value.correlationId];
            return true;
        }
        return false;
    }

    clear(): void {
        _.forOwn(this.subscriptions, (sub: T,
                                      key: string): void => {
            sub.removeAllListeners();
        });
        this.subscriptions = {};
    }

}
