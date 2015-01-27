/// <reference path='../typings/tsd.d.ts' />
import Subscription = require('./Subscription');
import Buffer = require('./Buffer');

export = SubscriptionWithBuffer;

class SubscriptionWithBuffer extends Subscription {

    private buffer : Buffer<{}>;

    constructor( cid: number,
                 security: string,
                 fields: string[],
                 maxBufferLength: number,
                 options?: any) {
        super(cid, security, fields, options);

        this.buffer = new Buffer<{}>(maxBufferLength);
    }

    pushBuffer(data: any) : void {
        this.buffer.push(data);
    }

    getNewBuffer() : {} {
        var buff = this.buffer.getNew();
        return {
            'correlationId' : this.correlationId,
            'data' : buff[0],
            'missed_ticks' : buff[1]
        };
    }

    getOldBuffer() : {} {
        var buff = this.buffer.getOld();
        return {
            'correlationId' : this.correlationId,
            'data' : buff[0],
            'missed_ticks' : buff[1]
        };
    }

    clearBuffer() : void {
        this.buffer.clear();
    }

    flushBuffer() : {} {
        var buff = this.buffer.flush();
        return {
            'correlationId' : this.correlationId,
            'data' : buff[0],
            'missed_ticks' : buff[1]
        };
    }

    hasNewBufferData(): boolean {
        return this.buffer.hasNew();
    }

    hasOldBufferData(): boolean {
        return this.buffer.hasOld();
    }

}
