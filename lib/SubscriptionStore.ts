/// <reference path="../typings/tsd.d.ts" />
import StrMap = require('./StrMap');
import Subscription = require('./Subscription');

export = SubscriptionStore;

class SubscriptionStore<T extends Subscription> {

    protected subscriptions = new StrMap<T>();

    get size() : number {
        return this.subscriptions.size;
    }

    get( cid: number ) : T {
        return this.has(cid) ? this.subscriptions.get(String(cid)) : undefined;
    }

    getAll() : T[] {
        return this.subscriptions.values();
    }

    add( subscription: T ) : boolean {
        if (this.has(subscription.correlationId)) {
            return false;
        }
        this.subscriptions.set(String(subscription.correlationId), subscription);
        return true;
    }

    has( value: number ) : boolean;
    has( value: T ) : boolean;
    has( value: any ) : boolean {
        if (typeof value === 'number') {
            return this.subscriptions.has(String(value));
        }
        else if (typeof value === 'object') {
            return this.subscriptions.has(String(value.correlationId));
        }
        return false;
    }

    delete( value: number ) : boolean;
    delete( value: T ) : boolean;
    delete( value: any ) : boolean {
        if (typeof value === 'number') {
            if (!this.has(value)) {
                return false;
            }
            this.subscriptions.delete(String(value));
            return true;
        }
        else if (typeof value === 'object') {
            if (!this.has(value)) {
                return false;
            }
            this.subscriptions.delete(String(value.correlationId));
            return true;
        }
        return false;
    }

    clear( ) : void {
        this.subscriptions.forEach((sub: T,
                                    key: string,
                                    map: StrMap<T>) : void => {
            sub.removeAllListeners();
        });
        this.subscriptions.clear();
    }

}
