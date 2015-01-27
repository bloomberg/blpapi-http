/// <reference path="../typings/tsd.d.ts" />
import StrMap = require('./StrMap');
import Subscription = require('./SubscriptionWithBuffer');
import SubscriptionStore = require('./SubscriptionStore');

export = SubscriptionStoreWithBuffer;

class SubscriptionStoreWithBuffer extends SubscriptionStore<Subscription>{

    getAllNewBuffers() : {}[] {
        var buffers : {}[] = [];
        this.subscriptions.forEach((sub: Subscription,
                                    key: string,
                                    map: StrMap<Subscription>) : void => {
            if (sub.hasNewBufferData()) {
                buffers.push(sub.getNewBuffer());
            }
        });
        return buffers;
    }

    getAllOldBuffers() : {}[] {
        var buffers : {}[] = [];
        this.subscriptions.forEach((sub: Subscription,
                                    key: string,
                                    map: StrMap<Subscription>) : void => {
            if (sub.hasOldBufferData()) {
                buffers.push(sub.getOldBuffer());
            }
        });
        return buffers;
    }

    clearAllBuffers() : void {
        this.subscriptions.forEach((sub: Subscription,
                                    key: string,
                                    map: StrMap<Subscription>) : void => {
            sub.clearBuffer();
        });
    }

}
