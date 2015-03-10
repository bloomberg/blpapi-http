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

    // Opaque object representing an authorized Identity.
    export interface Identity {

    }

    import events = require('events');

    export interface ISession extends NodeJS.EventEmitter {
        start(): Session;
        authorize(uri: string, cid: number): number;
        authorizeUser(request: any, cid: number): number;
        stop(): Session;
        destroy(): Session;
        openService(uri: string, cid: number): number;
        subscribe(subs: Subscription[], identity?: Identity, label?: string): Session;
        resubscribe(subs: Subscription[], label?: string): Session;
        unsubscribe(subs: Subscription[]): Session;
        request(uri: string,
                name: string,
                request: any,
                cid: number,
                identity?: Identity,
                label?: string): number;
    }

    export class Session extends events.EventEmitter implements ISession {
        constructor (args: SessionOpts);
        start(): Session;
        authorize(uri: string, cid: number): number;
        authorizeUser(request: any, cid: number): number;
        stop(): Session;
        destroy(): Session;
        openService(uri: string, cid: number): number;
        subscribe(subs: Subscription[], identity?: Identity, label?: string): Session;
        resubscribe(subs: Subscription[], label?: string): Session;
        unsubscribe(subs: Subscription[]): Session;
        request(uri: string,
                name: string,
                request: any,
                cid: number,
                identity?: Identity,
                label?: string): number;
    }
}
