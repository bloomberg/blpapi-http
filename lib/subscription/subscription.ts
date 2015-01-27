/// <reference path='../../typings/tsd.d.ts' />

import BAPI = require('../blpapi-wrapper');

export = Subscription;

class Subscription extends BAPI.Subscription {

    correlationId: number;

    constructor(cid: number,
                security: string,
                fields: string[],
                options?: any) {
        super(security, fields, options);

        this.correlationId = cid;
    }
}
