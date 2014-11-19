// Type definitions for blpapi-node
// Project: https://github.com/bloomberg/blpapi-node
// Definitions by: Tzvetan Mikov <https://github.com/tmikov>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

declare module "blpapi" {

    export interface SessionOpts {
        serverHost?: string;
        serverPort?: number;
    }

    export interface Subscription {
        security: string;
        fields: string[];
        options?: any;
        correlation: number;
    }

    import EventEmitter = NodeJS.EventEmitter;

    export class Session implements EventEmitter {
        constructor (args: SessionOpts);
        start(): Session;
        authorize(uri: string, cid: number): number;
        stop(): Session;
        destroy(): Session;
        openService(uri: string, cid: number): number;
        subscribe(subs: Subscription[], label?: string): Session;
        resubscribe(subs: Subscription[], label?: string): Session;
        unsubscribe(subs: Subscription[]): Session;
        request(uri: string, name: string, request: any, cid: number, label?: string): number;

        addListener(event: string, listener: Function): EventEmitter;
        on(event: string, listener: Function): EventEmitter;
        once(event: string, listener: Function): EventEmitter;
        removeListener(event: string, listener: Function): EventEmitter;
        removeAllListeners(event?: string): EventEmitter;
        setMaxListeners(n: number): void;
        listeners(event: string): Function[];
        emit(event: string, ...args: any[]): boolean;
    }
}
