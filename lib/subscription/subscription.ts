/// <reference path='../../typings/tsd.d.ts' />

import BAPI = require('../blpapi-wrapper');
import BufferManager = require('../util/historical-buffer-manager');
import interfaces = require('../interface');

export = Subscription;

class Subscription extends BAPI.Subscription implements interfaces.ISubscription {

    correlationId: number;
    buffer: interfaces.IHistoricalBufferManager<Object> = null;

    constructor(cid: number,
                security: string,
                fields: string[],
                options?: any,
                maxBufferLength?: number) {
        super(security, fields, options);

        this.correlationId = cid;
        if (5 === arguments.length) {  // Instantiate buffer only if buffer length is specified
            this.buffer = new BufferManager<Object>(2, maxBufferLength);
        }
    }
}
