/// <reference path="../typings/tsd.d.ts" />
import Promise = require('bluebird');
import debugMod = require('debug');
import _ = require('lodash');
import bunyan = require('bunyan');
import uuid = require('node-uuid');
import webSocket = require('ws');
import BAPI = require('./blpapi-wrapper');
import SubscriptionStore = require('./SubscriptionStore');
import Subscription = require('./Subscription');
import conf = require('./config');

interface Socket {
    log: bunyan.Logger; // Add bunyan logger to socket
    isConnected(): boolean;
    getIP(): string;
    getCert(): any;
    emit(name: string, ...args: any[]): void;
    disconnect(): void;
    on(event: string, listener: Function): void;
}

class SocketIOWrapper implements Socket {
    private socket: SocketIO.Socket;
    public log: bunyan.Logger;

    constructor(s: SocketIO.Socket) {
        this.socket = s;
    }

    isConnected() : boolean {
        return this.socket.connected;
    }

    getIP(): string {
        return (<any>this.socket).handshake.headers['x-forwarded-for']
               || (<any>this.socket).conn.remoteAddress;
    }

    getCert(): any {
        return this.socket.request.connection.getPeerCertificate();
    }

    emit(name: string, ...args: any[]): void {
        this.socket.emit(name, args);
    }

    disconnect(): void {
        this.socket.disconnect(true);
    }

    on(event: string, listener: Function): void {
        this.socket.on(event, listener);
    }
}

class WSWrapper implements Socket {
    private socket: webSocket;
    private eventListeners: {[index: string]: Function} = {};
    public log: bunyan.Logger;

    constructor(s: webSocket) {
        this.socket = s;

        this.socket.on('message', (message: string): void => {
            var obj: any;
            try {
                obj = JSON.parse(message);
            } catch (ex) {
                this.log.debug('error parsing message object:', ex);
                this.emit('err', ex);
                return;
            }

            if (!_.has(obj, 'type') || !_.isString(obj.type)) {
                this.log.debug('Invalid message type received.');
                this.emit('err', { message: 'Invalid message type received.'});
                return;
            }

            if (obj.type !== 'disconnect' && _.has(this.eventListeners, obj.type)) {
                this.eventListeners[obj.type](obj.data);
            }
        });

        this.socket.on('close', (): void => {
            if (_.has(this.eventListeners, 'disconnect')) {
                this.eventListeners['disconnect']();
            }
        });
    }

    isConnected() : boolean {
        return this.socket.readyState === webSocket.OPEN;
    }

    getIP(): string {
        return this.socket.upgradeReq.headers['x-forwarded-for']
               || this.socket.upgradeReq.connection.remoteAddress;
    }

    getCert(): any {
        return (<any>this.socket).upgradeReq.connection.getPeerCertificate();
    }

    emit(name: string, ...args: any[]): void {
        this.socket.send(JSON.stringify({type: name, data: args}));
    }

    disconnect(): void {
        this.socket.close();
    }

    on(event: string, listener: Function): void {
        this.eventListeners[event] = listener;
    }
}

export = WebSocketHandler;

class WebSocketHandler {

    private blpSession: BAPI.Session;
    private logger: bunyan.Logger;

    constructor(blpsess: BAPI.Session) {
        this.blpSession = blpsess;
        this.logger = bunyan.createLogger(conf.get('loggerOptions'));
    }

    public onConnect_sio(): (s: SocketIO.Socket) => void {
        var blpSession = this.blpSession;
        var logger = this.logger;
        var onConnect = this.onConnect;
        return function onConnect_sio(s: SocketIO.Socket): void {
            var socket: Socket = new SocketIOWrapper(s);
            onConnect(socket, logger, blpSession);
        };
    }

    public onConnect_ws(): (s: webSocket) => void {
        var blpSession = this.blpSession;
        var logger = this.logger;
        var onConnect = this.onConnect;
        return function onConnect_sio(s: webSocket): void {
            var socket: Socket = new WSWrapper(s);
            onConnect(socket, logger, blpSession);
        };
    }

    private onConnect(socket: Socket, logger: bunyan.Logger, blpSession: BAPI.Session): void {

            // Setup logging for socket
            socket.log = logger.child({req_id: uuid.v4()});
            socket.log.info({Address: socket.getIP()}, 'Client connected.');
            if (conf.get('logging.clientDetail')) {
                socket.log.debug({cert: socket.getCert()}, 'Client certificate.');
            }

            // Create subscriptions store
            var activeSubscriptions = new SubscriptionStore<Subscription>();
            var receivedSubscriptions = new SubscriptionStore<Subscription>();

            // Clean up sockets for cases where the underlying session terminated unexpectedly
            blpSession.once('SessionTerminated', (): void => {
                socket.log.debug('Session terminated.');
                if (socket.isConnected()) {
                    socket.log.debug('Session terminated unexpectedly. Terminate socket.');
                    socket.emit('err', { message: 'Session terminated unexpectedly.' });
                    socket.disconnect();
                }
            });

            // Subscribe
            socket.on('subscribe', (data: { 'correlationId': number;
                                            'security': string;
                                            'fields': string[];
                                            'options'?: any }[]): void => {
                socket.log.info('Subscribe request received');
                // Log body if configured
                if (conf.get('logging.reqBody')) {
                    socket.log.debug({body: data}, 'Subscribe body.');
                }

                // Validate input options
                var subscriptions : Subscription[] = [];
                if (!data.length) {
                    socket.log.debug('No valid subscriptions found.');
                    socket.emit('err', { message: 'No valid subscriptions found.' });
                    return;
                }
                data.forEach((s: any): void => {
                    // Check if all requests are valid
                    // The Subscribe request will proceed only if all subscriptions are valid
                    if (!_.has(s, 'correlationId') || !_.isNumber(s.correlationId)
                        || !_.has(s, 'security') || !_.isString(s.security)
                        || !_.has(s, 'fields') || !_.isArray(s.fields)) {
                        socket.log.debug('Invalid subscription option.');
                        socket.emit('err', { message: 'Invalid subscription option.' });
                        return;
                    }
                    if (receivedSubscriptions.has(s.correlationId)) {
                        socket.log.debug('Correlation Id already exists.');
                        socket.emit('err', { message: 'Correlation Id already exists.' });
                        return;
                    }

                    var sub = new Subscription(s.correlationId,
                                               s.security,
                                               s.fields,
                                               s.options);
                    subscriptions.push(sub);
                    receivedSubscriptions.add(sub);

                    // Add event listener for each subscription
                    sub.on('data', (data : any) : void => {
    // For debug purpose
    var ts = process.hrtime();
    socket.log.debug({data: {cid: sub.correlationId, time: ts}}, 'Data received');
    data['DEBUG_TIME'] = ts[0] + '.' + ts[1];

                        // Emit the data
                        // TODO: Acknowledgement callback function?
                        socket.emit('data', {'correlationId' : sub.correlationId,
                                             'data' : data});
                        socket.log.info('Data sent');
                    });
                });

                // Subscribe user request through blpapi-wrapper
                blpSession.subscribe(subscriptions)
                .then((): void => {
                    if (socket.isConnected()) {
                        subscriptions.forEach((s: Subscription): void => {
                            activeSubscriptions.add(s);
                        });
                        socket.log.debug('Subscribed');
                        socket.emit('subscribed');
                    } else { // Unsubscribe if socket already closed
                        try {
                            blpSession.unsubscribe(subscriptions);
                        } catch (ex) {
                            socket.log.error(ex, 'Error Unsubscribing');
                        }
                        subscriptions.forEach((s: Subscription): void => {
                            s.removeAllListeners();
                            receivedSubscriptions.delete(s);
                        });
                        socket.log.debug('Unsubscribed all active subscriptions');
                    }
                })
                .catch( (err: Error): void => {
                    socket.log.error(err, 'Error Subscribing');
                    subscriptions.forEach((s: Subscription): void => {
                        s.removeAllListeners();
                        receivedSubscriptions.delete(s);
                    });
                    if (socket.isConnected()) {
                        socket.emit('err', err);
                    }
                });
            });

            // Unsubscribe
            socket.on('unsubscribe', (data : { 'correlationIds': number[] }): void => {
                socket.log.info('Unsubscribe request received');

                if (!activeSubscriptions.size) {
                    socket.log.debug('No active subscriptions.');
                    socket.emit('err', { message: 'No active subscriptions.' });
                    return;
                }

                var subscriptions : Subscription[] = [];

                // If no correlation Id specified
                // the default behavior is to unsubscribe all active subscriptions
                if (!data
                    || !_.has(data, 'correlationIds')
                    || !_.isArray(data.correlationIds)
                    || !data.correlationIds.length) {
                    subscriptions = activeSubscriptions.getAll();
                }
                else {
                    // Otherwise, validate all correlation Id
                    // Will unsubscribe only the valid correlation Id, ignore the rest
                    data.correlationIds.forEach((cid: number): void => {
                        if (activeSubscriptions.has(cid)) {
                            subscriptions.push(activeSubscriptions.get(cid));
                        }
                    });
                }

                if (!subscriptions.length) {
                    socket.log.debug('No valid correlation Id.');
                    socket.emit('err', { message: 'No valid correlation Id.' });
                    return;
                }

                try {
                    blpSession.unsubscribe(subscriptions);
                } catch (ex) {
                    socket.log.error(ex, 'Error Unsubscribing');
                    socket.emit('err', { message: 'error unsubscribing:' + ex});
                    return;
                }
                subscriptions.forEach((s: Subscription): void => {
                    s.removeAllListeners();
                    activeSubscriptions.delete(s);
                    receivedSubscriptions.delete(s);
                });
                receivedSubscriptions.size
                    ? socket.emit('unsubscribed')
                    : socket.emit('unsubscribed all');
                socket.log.debug({activeSubscriptions: activeSubscriptions.size}, 'Unsubscribed.');
            });

            // Disconnect
            socket.on('disconnect', (): void => {
                // Unsubscribe all active subscriptions
                if (activeSubscriptions.size) {
                    var subscriptions : Subscription[] = activeSubscriptions.getAll();
                    try {
                        blpSession.unsubscribe(subscriptions);
                    } catch (ex) {
                        socket.log.error(ex, 'Error Unsubscribing');
                    }
                    subscriptions.forEach((s: Subscription): void => {
                        s.removeAllListeners();
                        activeSubscriptions.delete(s);
                        receivedSubscriptions.delete(s);
                    });
                    socket.log.debug('Unsubscribed all active subscriptions');
                }
                socket.log.info('Client disconnected.');
            });
        }


}
