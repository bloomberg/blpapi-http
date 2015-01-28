/// <reference path='../typings/tsd.d.ts' />
import bunyan = require('bunyan');
import conf = require('./config');

export = Buffer;

class Buffer<T> {

    private buff: T[] = [];
    private lastRetrievedIndex: number = -1;
    private maxBufferLength: number;
    private numOverflow: number = 0;
    private lastOverflow: number = 0;
    private logger: bunyan.Logger;

    constructor(maxBuffLength: number) {
        this.maxBufferLength = maxBuffLength;
        this.logger = bunyan.createLogger(conf.get('loggerOptions'));
    }

    push(data: T) : void {
        // If already reach the maximum buffer length,
        // shift the buffer and increment the numOverflow counter
        if (this.buff.length - this.lastRetrievedIndex > this.maxBufferLength) {
            this.buff.splice(this.lastRetrievedIndex + 1, 1);
            ++this.numOverflow;
            this.logger.debug('Buffer overflow.');
        }

        this.buff.push(data);
    }

    getNew() : any[] {
        if (!this.hasNew()) {
            return new Array<T>();
        }

        var begin: number = this.lastRetrievedIndex + 1;
        this.lastOverflow = this.numOverflow;
        this.lastRetrievedIndex = this.buff.length - 1;
        this.numOverflow = 0;
        return [this.buff.slice(begin), this.lastOverflow];
    }

    getOld() : any[] {
        if (!this.hasOld()) {
            return new Array<T>();
        }
        return [this.buff.slice(0, this.lastRetrievedIndex + 1), this.lastOverflow];
    }

    clear() : void {
        if (!this.buff.length || this.lastRetrievedIndex < 0) {
            return;
        }

        this.buff.splice(0, this.lastRetrievedIndex + 1);
        this.lastRetrievedIndex = -1;
        this.lastOverflow = 0;
    }

    flush() : any[] {
        var result = this.getNew();
        this.clear();
        return result;
    }

    hasNew() : boolean {
        return this.lastRetrievedIndex < (this.buff.length - 1);
    }

    hasOld() : boolean {
        return this.lastRetrievedIndex >= 0;
    }

}
