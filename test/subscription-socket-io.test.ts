/// <reference path='../typings/tsd.d.ts' />

import child = require('child_process');
import util = require('util');
import Promise = require('bluebird');
import _ = require('lodash');
import should = require('should');
import io = require('socket.io-client');
import TestHelper = require('./lib/test-helper');
should(true).ok;    // Added so ts won't get rid of should module

var url = 'http://localhost:3001/subscription';
var opt = {
    reconnection: false,
    multiplex: false
};

describe('Subscription-socket-io', (): void => {
    var server: child.ChildProcess;
    var ipc: TestHelper.IOurSocket;
    var socket: SocketIOClient.Socket;

    // Create test server
    // Use function instead of lambda to avoid ts capturing "this" in a variable
    before(function(done: Function): void {
        this.timeout(0);    // Turn off timeout for before all hook
        TestHelper.startServer()
            .then((r: {
                        server: child.ChildProcess;
                        ipc: TestHelper.IOurSocket;
                  }): void => {
                server = r.server;
                ipc = r.ipc;
                done();
            });
    });

    // Shut-down server
    after((): void => {
        server.kill();
    });

    // Connect to the server for every test cases
    beforeEach((): void => {
        socket = io.connect(url, opt);
    });

    // Disconnect to the server if it is still connected
    afterEach((): void => {
        if (socket.connected) {
            socket.disconnect();
        }
    });

    describe('blpSession cannot be started', (): void => {
        // Set instructions
        beforeEach((): void => {
            ipc.once('wait-to-start', (): void => {
                ipc.emit('start-fail');
            });
        });

        it('should disconnect client if blpSession cannot be started', (done: Function): void => {
            socket.once('err', (err: Error): void => {
                err.message.should.be.a.String
                    .and.equal('Unexpected error: Session Fail to Start.');
            });
            socket.once('disconnect', (): void => {
                done();
            });
        });
    });

    describe('blpSession start successfully', (): void => {
        // Set instructions
        before((): Promise<void> => {
            return ipc.emitAcknowledge('set-instructions', { start: true });
        });

        // Clear instructions
        after((): Promise<void> => {
            return ipc.emitAcknowledge('clear-instructions');
        });

        it('should let client connect successfully', (done: Function): void => {
            socket.once('connect', (): void => {
                done();
            });
        });

        describe('validate subscription options', (): void => {
            it('should send error if no subscription object sent', (done: Function): void => {
                var counter = 0;
                socket.emit('subscribe');
                socket.emit('subscribe', []);
                socket.on('err', (err: Error): void => {
                    err.message.should.be.a.String
                        .and.equal('No valid subscriptions found.');
                    if (++counter === 2) {
                        done();
                    }
                });
            });
            it('should send error if subscription object is invalid', (done: Function): void => {
                var counter = 0;
                socket.emit('subscribe', [{}]);
                socket.emit('subscribe', [{ security: 'AAPL US Equity' }]);
                socket.emit('subscribe', [{ correlationId: 0 }]);
                socket.emit('subscribe', [{ fields: ['LAST_PRICE'] }]);
                socket.on('err', (err: Error): void => {
                    err.message.should.be.a.String
                        .and.equal('Invalid subscription option.');
                    if (++counter === 4) {
                        done();
                    }
                });
            });
            it('should send error if duplicate correlationId found', (done: Function): void => {
                socket.emit('subscribe',
                            [
                                { security: 'AAPL', correlationId: 0, fields: ['LAST_PRICE'] },
                                { security: 'AAPL', correlationId: 0, fields: ['LAST_PRICE'] }
                            ]
                );
                socket.on('err', (err: Error): void => {
                    err.message.should.be.a.String
                        .and.equal('Correlation id 0 already exists.');
                    done();
                });
            });
        });

        describe('service open failure', (): void => {
            before((): void => {
                ipc.on('wait-to-openService', (data: any): void => {
                    if ('//blp/mktdata' === data.uri) {
                        ipc.emit(util.format('openService-%d-fail', data.cid));
                    } else {
                        ipc.emit(util.format('openService-%d-success', data.cid));
                    }
                });
            });

            after((): void => {
                ipc.off('wait-to-openService');
            });

            it('should send error if all services cannot be opened', (done: Function): void => {
                socket.emit('subscribe',
                            [
                                { security: 'AAPL', correlationId: 0, fields: ['LAST_PRICE'] }
                            ]
                );
                socket.on('err', (err: Error): void => {
                    err.message.should.be.a.String
                        .and.equal('//blp/mktdata Service Fail to Open.');
                    done();
                });
            });
            it('should send error if part of service cannot be opened', (done: Function): void => {
                socket.emit('subscribe',
                            [
                                { security: '//blp/mktdata', correlationId: 0, fields: ['PRICE'] },
                                { security: '//blp/mktvwap', correlationId: 1, fields: ['PRICE'] }
                            ]
                );
                socket.on('err', (err: Error): void => {
                    err.message.should.be.a.String
                        .and.equal('//blp/mktdata Service Fail to Open.');
                    done();
                });
            });
        });

        describe('service open successfully', (): void => {
            before((): void => {
                ipc.on('wait-to-openService', (data: any): void => {
                    ipc.emit(util.format('openService-%d-success', data.cid));
                });
            });

            after((): void => {
                ipc.off('wait-to-openService');
            });

            describe('#subscribe', (): void => {
                it('should subscribe client successfully', (done: Function): void => {
                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.on('subscribed', (): void => {
                        done();
                    });
                });
                it('should emit 1 subscription data', (done: Function): void => {
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        if (++counter === 1) {
                            done();
                        }
                    });
                });
                it('should emit 3 consecutive subscription data', (done: Function): void => {
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        if (++counter === 3) {
                            done();
                        }
                    });
                });
                it('should emit 1 subscription data then another', (done: Function): void => {
                    var cid: number;
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        cid = subscriptions[0].correlation;
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });


                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        ++counter;
                        if (counter === 1) {
                            ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                        } else if (counter === 2) {
                            done();
                        }
                    });
                });
                it('should emit 1 subscription data for each event', (done: Function): void => {
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketBarStart',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketBarUpdate',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketBarEnd',
                                             subscriptions[0].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktbar', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        if (++counter === 3) {
                            done();
                        }
                    });
                });
                it('should emit 1 data for each subscription', (done: Function): void => {
                    var counter: number = 0;
                    var cids: number[] = [];
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        cids.push(data.correlationId);
                        if (++counter === 2) {
                            _.sortBy(cids).should.eql([0, 1]);
                            done();
                        }
                    });
                });
                it('should emit 2 data for only one subscription', (done: Function): void => {
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        data.correlationId.should.be.a.Number.and.equal(1);
                        if (++counter === 2) {
                            done();
                        }
                    });
                });
                it('should allow subsequent subscriptions', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.once('data', (data: any): void => {
                        data.correlationId.should.be.a.Number.and.equal(0);
                        ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                            ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                                 subscriptions[0].correlation));
                        });
                        socket.emit('subscribe',
                                    [
                                        {
                                            security: '//blp/mktdata',
                                            correlationId: 1,
                                            fields: ['P']
                                        }
                                    ]
                        );
                        socket.once('data', (data: any): void => {
                            data.correlationId.should.be.a.Number.and.equal(1);
                            done();
                        });
                    });
                });

                it('should receive correlation ids with subscribed event',
                   (done: Function): void => {
                    var subscriptions = [
                        { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                        { security: '//blp/mktdata', correlationId: 1, fields: ['P'] },
                        { security: '//blp/mktdata', correlationId: 2, fields: ['P'] }
                    ];
                    socket.emit('subscribe', subscriptions);
                    socket.on('subscribed', (correlationIds: number[]): void => {
                        correlationIds.sort().should.be.an.Array.and.eql([0, 1, 2]);
                        done();
                    });
                });
            });

            describe('#unsubscribe', (): void => {
                it('should error if no active subscription found', (done: Function): void => {
                    socket.emit('unsubscribe');
                    socket.on('err', (err: Error): void => {
                        err.message.should.be.a.String
                            .and.equal('No active subscriptions');
                        done();
                    });
                });
                it('should unsubscribe all if body is empty', (done: Function): void => {
                    var subscriptions = [
                        { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                        { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                    ];
                    socket.emit('subscribe', subscriptions);
                    socket.on('subscribed', (): void => {
                        socket.emit('unsubscribe');
                    });
                    socket.on('unsubscribed', (correlationIds: number[]): void => {
                        correlationIds.sort().should.be.an.Array.and.eql([0, 1]);
                        done();
                    });
                });
                it('should error if unsubscribe data object is invalid', (done: Function): void => {
                    var counter: number = 0;
                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('subscribed', (): void => {
                        socket.emit('unsubscribe', {});
                        socket.emit('unsubscribe', { foo: 'bar' });
                        socket.emit('unsubscribe', { correlationIds: 'bar' });
                        socket.emit('unsubscribe', { correlationIds: [] });
                    });
                    socket.on('err', (err: Error): void => {
                        err.message.should.be.a.String
                            .and.equal('Invalid unsubscribe data received.');
                        if (++counter === 4) {
                            done();
                        }
                    });
                });
                it('should error if correlation id is incorrect', (done: Function): void => {
                    var counter: number = 0;
                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('subscribed', (): void => {
                        socket.emit('unsubscribe', { correlationIds: [2] });
                        socket.emit('unsubscribe', { correlationIds: [1, 2] });
                    });
                    socket.on('err', (err: Error): void => {
                        if (++counter === 2) {
                            done();
                        }
                    });
                });
                it('should unsubscribe all if all correlationIds', (done: Function): void => {
                    var subscriptions = [
                        { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                        { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                    ];
                    socket.emit('subscribe', subscriptions);
                    socket.on('subscribed', (): void => {
                        socket.emit('unsubscribe', { correlationIds: [0, 1] });
                    });
                    socket.on('unsubscribed', (correlationIds: number[]): void => {
                        correlationIds.should.be.an.Array.and.eql([0, 1]);
                        done();
                    });
                });
                it('should unsubscribe part if one correlationIds', (done: Function): void => {
                    var cids: number[] = [];
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        cids.push(subscriptions[0].correlation);
                        cids.push(subscriptions[1].correlation);
                    });
                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('subscribed', (): void => {
                        socket.emit('unsubscribe', { correlationIds: [0] });
                    });
                    socket.on('unsubscribed', (): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents', cids[1]));
                    });
                    socket.on('data', (data: any): void => {
                        data.correlationId.should.be.a.Number.and.equal(1);
                        if (++counter === 1) {
                            done();
                        }
                    });
                });
                it('should send 3 data then unsubscribe', (done: Function): void => {
                    var counter: number = 0;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });

                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                                ]
                    );
                    socket.on('data', (data: any): void => {
                        if (++counter === 3) {
                            socket.emit('unsubscribe');
                        }
                    });
                    socket.on('unsubscribed', (correlationIds: number[]): void => {
                        correlationIds.should.be.an.Array.and.eql([0]);
                        socket.disconnect();
                    });
                    socket.on('disconnect', (): void => {
                        done();
                    });
                });

                it('should receive correlation ids with unsubscribed event',
                   (done: Function): void => {
                    var subscriptions = [
                        { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                        { security: '//blp/mktdata', correlationId: 1, fields: ['P'] },
                        { security: '//blp/mktdata', correlationId: 2, fields: ['P'] }
                    ];
                    socket.emit('subscribe', subscriptions);
                    socket.on('subscribed', (): void => {
                        socket.emit('unsubscribe');
                    });
                    socket.on('unsubscribed', (correlationIds: number[]): void => {
                        correlationIds.sort().should.be.an.Array.and.eql([0, 1, 2]);
                        done();
                    });
                });
            });

            describe('#session terminated', (): void => {
                it('should disconnect existing connections', (done: Function): void => {
                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('subscribed', (): void => {
                        ipc.emit('terminate-session');
                    });
                    socket.on('disconnect', (): void => {
                        done();
                    });
                });
                it('should disconnect then reconnect', (done: Function): void => {
                    socket.emit('subscribe',
                                [
                                    { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                    { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                                ]
                    );
                    socket.on('subscribed', (): void => {
                        ipc.emit('terminate-session');
                    });
                    socket.on('disconnect', (): void => {
                        socket = io.connect(url, opt);
                        socket.on('connect', (): void => {
                            done();
                        });
                    });
                });
            });
        });
    });
});
