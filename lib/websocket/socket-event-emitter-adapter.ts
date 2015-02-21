/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import events = require('events');

// TYPEDEF
var EVENTEMITTERPROTOTYPE = events.EventEmitter.prototype;

export type EventEmitter = SocketIO.Socket | NodeJS.EventEmitter;

export class SocketEventEmitterAdapter implements events.EventEmitter {
    // DATA
    private emitter: EventEmitter;

    // CREATORS
    constructor(emitter: EventEmitter) {
        this.emitter = emitter;
    }

    // NodeJS.EventEmitter implement
    addListener(event: string, listener: Function): SocketEventEmitterAdapter {
        EVENTEMITTERPROTOTYPE.addListener.apply(this.emitter, arguments);
        return this;
    }

    on(event: string, listener: Function): SocketEventEmitterAdapter {
        EVENTEMITTERPROTOTYPE.on.apply(this.emitter, arguments);
        return this;
    }

    once(event: string, listener: Function): SocketEventEmitterAdapter {
        EVENTEMITTERPROTOTYPE.once.apply(this.emitter, arguments);
        return this;
    }

    removeListener(event: string, listener: Function): SocketEventEmitterAdapter {
        EVENTEMITTERPROTOTYPE.removeListener.apply(this.emitter, arguments);
        return this;
    }

    removeAllListeners(event?: string): SocketEventEmitterAdapter {
        EVENTEMITTERPROTOTYPE.removeAllListeners.apply(this.emitter, arguments);
        return this;
    }

    setMaxListeners(n: number): void {
        EVENTEMITTERPROTOTYPE.setMaxListeners.apply(this.emitter, arguments);
    }

    listeners(event: string): Function[] {
        return EVENTEMITTERPROTOTYPE.listeners.apply(this.emitter, arguments);
    }

    emit(event: string, ...args: any[]): boolean {
        if (this.emitter instanceof events.EventEmitter) {
            return EVENTEMITTERPROTOTYPE.emit.apply(this.emitter, arguments);
        } else {
            // Note that we want to stub calls to 'emit' because SocketIO.Socket.emit is specialized
            // and does not follow the the standard NodeJS.EventEmitter interface.
            assert(false, '“emit” should not be called on SocketEventEmitterAdapter');
            return false;
        }
    }
}
