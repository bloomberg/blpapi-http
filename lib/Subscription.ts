/// <reference path='../typings/tsd.d.ts' />
import events = require('events');
import BAPI = require('./blpapi-wrapper');

export = Subscription;

class Subscription extends events.EventEmitter implements BAPI.Subscription {

    correlationId: number;
    security: string;
    fields: string[];
    options: any;

    constructor( cid: number,
                 security: string,
                 fields: string[],
                 options?: any) {
        super();

        this.correlationId = cid;
        this.security = security;
        this.fields = fields;
        this.options = options;
    }

}
