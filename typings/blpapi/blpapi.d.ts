// Type definitions for blpapi-node
// Project: https://github.com/bloomberg/blpapi-node
// Definitions by: Tzvetan Mikov <https://github.com/tmikov>
// Definitions: https://github.com/borisyankov/DefinitelyTyped

/// <reference path="../node/node.d.ts" />

declare module "blpapi" {

    import events = require('events');
    import Promise = require('bluebird');

    export interface ISessionOpts {
        serverHost?: string;
        serverPort?: number;
        authenticationOptions?: string;
    }

    // Opaque object representing an authorized Identity.
    export interface IIdentity {
    }
    
    export interface IRequestCallback {
        (err: Error, data?: any, isFinal?: boolean): void;
    }

    export class Subscription extends events.EventEmitter {
        security: string;
        fields: string[];
        options: any;
        constructor(security: string, fields: string[], options?: any);
    }

    export class BlpApiError implements Error {
        static NAME: string;
        data: any;
        name: string;
        message: string;
        constructor(data: any);
    }

    export interface ISession {
        start(cb?: (err: any, value: any) => void): Promise<void>;
        stop(cb?: (err: any, value: any) => void): Promise<void>;
        request(uri: string, requestName: string, request: any, callback: IRequestCallback): void;
        request(uri: string, requestName: string, request: any, identity: IIdentity, callback: IRequestCallback): void;
        request(uri: string, requestName: string, request: any, label: string, callback: IRequestCallback): void;
        request(uri: string, requestName: string, request: any, identity: IIdentity, label: string, callback: IRequestCallback): void;
        authenticate(cb?: (err: any, value: any) => void): Promise<string>;
        authorize(token: string, cb?: (err: any, value: any) => void): Promise<IIdentity>;
        subscribe(subscriptions: Subscription[], cb?: (err: any) => void): Promise<void>;
        subscribe(subscriptions: Subscription[], identity: IIdentity, cb?: (err: any) => void): Promise<void>;
        subscribe(subscriptions: Subscription[], label: string, cb?: (err: any) => void): Promise<void>;
        subscribe(subscriptions: Subscription[], identity: IIdentity, label: string, cb?: (err: any) => void): Promise<void>;
        unsubscribe(subscriptions: Subscription[], label?: string): void;
    }
    
    export class Session extends events.EventEmitter implements ISession {
        constructor(opts: ISessionOpts);
        start(cb?: (err: any, value: any) => void): Promise<void>;
        stop(cb?: (err: any, value: any) => void): Promise<void>;
        request(uri: string, requestName: string, request: any, callback: IRequestCallback): void;
        request(uri: string, requestName: string, request: any, identity: IIdentity, callback: IRequestCallback): void;
        request(uri: string, requestName: string, request: any, label: string, callback: IRequestCallback): void;
        request(uri: string, requestName: string, request: any, identity: IIdentity, label: string, callback: IRequestCallback): void;
        authenticate(cb?: (err: any, value: any) => void): Promise<string>;
        authorize(token: string, cb?: (err: any, value: any) => void): Promise<IIdentity>;
        subscribe(subscriptions: Subscription[], cb?: (err: any) => void): Promise<void>;
        subscribe(subscriptions: Subscription[], identity: IIdentity, cb?: (err: any) => void): Promise<void>;
        subscribe(subscriptions: Subscription[], label: string, cb?: (err: any) => void): Promise<void>;
        subscribe(subscriptions: Subscription[], identity: IIdentity, label: string, cb?: (err: any) => void): Promise<void>;
        unsubscribe(subscriptions: Subscription[], label?: string): void;
    }
}
