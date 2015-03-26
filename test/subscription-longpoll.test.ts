/// <reference path='../typings/tsd.d.ts' />

import child = require('child_process');
import fs = require('fs');
import path = require('path');
import util = require('util');
import Promise = require('bluebird');
import _ = require('lodash');
import should = require('should');
import request = require('request');
import TestHelper = require('./lib/test-helper');
should(true).ok;    // Added so ts won't get rid of should module

var HOST = 'https://localhost:3000';

describe('Subscription-longpoll', (): void => {
    var ipc: TestHelper.IOurSocket;
    var aOpts: any;

    // Create test server
    // Use function instead of lambda to avoid ts capturing "this" in a variable
    before(function(done: Function): void {
        this.timeout(0);    // Turn off timeout for before all hook
        TestHelper.startServer(true)
            .then((s: TestHelper.IOurSocket): void => {
                ipc = s;
                done();
            })
            .catch((err: Error): void => {
                console.log(err);
                throw err;
            });
    });

    // Regenerate client cert and load it for every test case
    // Use function instead of lambda to avoid ts capturing "this" in a variable
    beforeEach(function(done: Function): void {
        this.timeout(0);    // Turn off timeout for before all hook
        (Promise.promisify(child.execFile))('./scripts/gen_client_cert.sh', ['./temp'])
            .then((): void => {
                aOpts = {
                    cert: fs.readFileSync(path.resolve(__dirname, '../temp/client-cert.pem')),
                    key: fs.readFileSync(path.resolve(__dirname, '../temp/client-key.pem')),
                    ca: fs.readFileSync(path.resolve(__dirname, '../temp/ca-cert.pem')),
                };
                done();
            });
    });

    // Shut-down server
    after((): Promise<any> => {
        return TestHelper.stopServer();
    });

    describe('blpSession cannot be started', (): void => {
        // Set instructions
        before((): Promise<void> => {
            return ipc.emitAcknowledge('set-instructions', { start: false });
        });

        // Clear instructions
        after((): Promise<void> => {
            return ipc.emitAcknowledge('clear-instructions');
        });

        it('should fail with 500 if blpSession cannot be started', (done: Function): void => {
            var opt: any = {
                url: HOST + '/subscription?action=start',
                body: [
                        { security: 'A', correlationId: 0, fields: ['P'] },
                        { security: 'G', correlationId: 1, fields: ['P'] }
                      ],
                json: true,
                agentOptions: aOpts
            };
            request.post(opt, (error: Error, response: any, body: any): void => {
                should.ifError(error);
                response.statusCode.should.be.a.Number.and.equal(500);
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

        describe('#subscribe', (): void => {
            it('should fail with 400 if missing query param', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription',
                    body: [
                            { security: 'A', correlationId: 0, fields: ['P'] },
                            { security: 'G', correlationId: 1, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });

            describe('validate subscription options', (): void => {
                it('should fail with 400 if empty subscription body', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Invalid subscription request body.');
                        done();
                    });
                });
                it('should fail with 400 if empty subscription body', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Invalid subscription request body.');
                        done();
                    });
                });
                it('should fail with 400 if body is invalid', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [{}],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Invalid subscription option.');
                        done();
                    });
                });
                it('should fail with 400 if body only has security', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [{ security: 'AAPL US Equity' }],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Invalid subscription option.');
                        done();
                    });
                });
                it('should fail with 400 if body only has cid', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [{ correlationId: 0 }],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Invalid subscription option.');
                        done();
                    });
                });
                it('should fail with 400 if body only has fields', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [{ fields: ['LAST_PRICE'] }],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Invalid subscription option.');
                        done();
                    });
                });
                it('should send error if duplicate correlationId found', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: 'A', correlationId: 0, fields: ['P'] },
                                  { security: 'G', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String
                            .and.equal('Duplicate correlation Id received.');
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

                it('should fail with 500 if services cannot be opened', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(500);
                        body.message.should.be.a.String
                            .and.equal('//blp/mktdata Service Fail to Open.');
                        done();
                    });
                });
                it('should fail with 500 if service cannot be opened', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktvwap', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(500);
                        body.message.should.be.a.String
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

                it('should succeed with 200 if session is not expired', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        body.message.should.be.a.String.and.equal('Subscribed');
                        body.status.should.be.a.Number.and.equal(0);
                        body.correlationIds.sort().should.be.an.Array.and.eql([0, 1]);
                        done();
                    });
                });
                it('should unsubsribe if session expired', function(done: Function): void {
                    var EXPECTED_TIMEOUT: number = 4000;
                    ipc.off('wait-to-openService');
                    this.timeout(EXPECTED_TIMEOUT + 100);
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/pagedata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts,
                    };
                    var r = request.post(opt);
                    ipc.once('wait-to-openService', (data: any): void => {
                        function tmp(): void {
                            ipc.emit(util.format('openService-%d-success', data.cid));
                        }
                        r.abort();
                        setTimeout(tmp, EXPECTED_TIMEOUT);
                    });
                    var cid: number;
                    ipc.once('wait-to-subscribe', (data: any): void => {
                        cid = data[0].correlation;
                    });
                    ipc.on('wait-to-unsubscribe', (data: any): void => {
                        if (data[0].correlation === cid) {
                            ipc.off('wait-to-unsubscribe');
                            ipc.on('wait-to-openService', (data: any): void => {
                                ipc.emit(util.format('openService-%d-success', data.cid));
                            });
                            done();
                        }
                    });
                });

            });
        });

        describe('#poll', (): void => {
            before((): void => {
                ipc.on('wait-to-openService', (data: any): void => {
                    ipc.emit(util.format('openService-%d-success', data.cid));
                });
            });

            after((): void => {
                ipc.off('wait-to-openService');
            });

            it('should fail with 400 if missing query param', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription',
                    json: true,
                    agentOptions: aOpts
                };
                request.get(opt, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });
            it('should fail with 400 if poll id is NAN', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?pollid=abc',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.get(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        done();
                    });
                });
            it('should fail with 400 if no session created', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?pollid=0',
                    json: true,
                    agentOptions: aOpts
                };
                request.get(opt, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    body.message.should.be.a.String.and.equal('No active apisession found.');
                    done();
                });
            });
            it('should fail with 400 if no active subscriptions', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt = {
                        url: HOST + '/subscription?pollid=0',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.get(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String.and.equal('No active subscriptions.');
                        done();
                    });
                });
            });
            it('should fail with 400 if session expires', function(done: Function): void {
                var EXPECTED_TIMEOUT: number = 4000;
                this.timeout(EXPECTED_TIMEOUT + 100);
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt = {
                        url: HOST + '/subscription?pollid=0',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    setTimeout(
                        (): void => {
                            request.get(opt, (error: Error, response: any, body: any): void => {
                                should.ifError(error);
                                response.statusCode.should.be.a.Number.and.equal(400);
                                body.message.should.be.a.String
                                    .and.equal('No active apisession found.');
                                done();
                            });
                        },
                        EXPECTED_TIMEOUT
                    );
                });
            });
            describe('one subscription', (): void => {
                it('should poll one data back if data already arrives', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);
                            done();
                        });
                    });
                });
                it('should poll three data back', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData', 'TestData', 'TestData']);
                            done();
                        });
                    });
                });
                it('should poll three data back with one missed ticks', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(1);
                            body.data[0][0].data.should.eql(['TestData', 'TestData', 'TestData']);
                            done();
                        });
                    });
                });
                it('should poll one data back if data arrives after', (done: Function): void => {
                    var cid: number;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        cid = subscriptions[0].correlation;
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        setTimeout(
                            (): void => {
                                ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                            },
                            500
                        );
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);
                            done();
                        });
                    });
                });
                it('should poll one data back then another', (done: Function): void => {
                    var cid: number;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        cid = subscriptions[0].correlation;
                        ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);

                            ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                            ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                            opt.url = HOST + '/subscription?pollid=1';
                            request.get(opt, (error: Error, response: any, body: any): void => {
                                should.ifError(error);
                                response.statusCode.should.be.a.Number.and.equal(200);
                                response.headers.should.have.property('content-type')
                                    .equal('application/json');
                                body.status.should.be.a.Number.and.equal(0);
                                body.message.should.be.a.String.and.equal('OK');
                                body.data.should.be.an.Array.and.have.length(1);
                                body.data[0].should.be.an.Array.and.have.length(1);
                                body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                                body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                                body.data[0][0].data.should.eql(['TestData', 'TestData']);
                                done();
                            });
                        });
                    });
                });
                it('should be able to poll back last data', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);

                            request.get(opt, (error: Error, response: any, body: any): void => {
                                should.ifError(error);
                                response.statusCode.should.be.a.Number.and.equal(200);
                                response.headers.should.have.property('content-type')
                                    .equal('application/json');
                                body.status.should.be.a.Number.and.equal(0);
                                body.message.should.be.a.String.and.equal('OK');
                                body.data.should.be.an.Array.and.have.length(1);
                                body.data[0].should.be.an.Array.and.have.length(1);
                                body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                                body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                                body.data[0][0].data.should.eql(['TestData']);
                                done();
                            });
                        });
                    });
                });
                it('should fail with 409 if poll id is not contiguous', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);

                            opt.url = HOST + '/subscription?pollid=2';
                            request.get(opt, (error: Error, response: any, body: any): void => {
                                should.ifError(error);
                                response.statusCode.should.be.a.Number.and.equal(409);
                                body.message.should.be.a.String.and.equal('Invalid Poll Id 2');
                                done();
                            });
                        });
                    });
                });
                it('should fail with 409 if poll id is old', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);

                            opt.url = HOST + '/subscription?pollid=-1';
                            request.get(opt, (error: Error, response: any, body: any): void => {
                                should.ifError(error);
                                response.statusCode.should.be.a.Number.and.equal(409);
                                body.message.should.be.a.String.and.equal('Invalid Poll Id -1');
                                done();
                            });
                        });
                    });
                });
                it('should fail with 408 if poll time out', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(408);
                            body.message.should.be.a.String
                                .and.equal('No subscription data within 1000ms.');
                            done();
                        });
                    });
                });
                it('should be able to poll again after time out', (done: Function): void => {
                    var cid: number;
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        cid = subscriptions[0].correlation;
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                            request.get(opt, (error: Error, response: any, body: any): void => {
                                should.ifError(error);
                                response.statusCode.should.be.a.Number.and.equal(200);
                                response.headers.should.have.property('content-type')
                                    .equal('application/json');
                                body.status.should.be.a.Number.and.equal(0);
                                body.message.should.be.a.String.and.equal('OK');
                                body.data.should.be.an.Array.and.have.length(1);
                                body.data[0].should.be.an.Array.and.have.length(1);
                                body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                                body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                                body.data[0][0].data.should.eql(['TestData']);
                                done();
                            });
                        });
                    });
                });
            });

            describe('two subscription', (): void => {
                it('should poll one data back for each subscription', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(2);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);
                            body.data[0][1].correlationId.should.be.a.Number.and.equal(1);
                            body.data[0][1].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][1].data.should.eql(['TestData', 'TestData']);
                            done();
                        });
                    });
                });
                it('should poll one data back for 1st subscription', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[0].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData', 'TestData']);
                            done();
                        });
                    });
                });
                it('should poll one data back for last subscription', (done: Function): void => {
                    ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                        ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                             subscriptions[1].correlation));
                    });
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(1);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData', 'TestData']);
                            done();
                        });
                    });
                });
            });
        });

        describe('#unsubscribe', (): void => {
            before((): void => {
                ipc.on('wait-to-openService', (data: any): void => {
                    ipc.emit(util.format('openService-%d-success', data.cid));
                });
            });

            after((): void => {
                ipc.off('wait-to-openService');
            });

            it('should fail with 400 if missing query param', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription',
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });
            it('should fail with 400 if query param is invalid', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=stp',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        done();
                    });
                });
            it('should fail with 400 if no session created', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?action=stop',
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    body.message.should.be.a.String.and.equal('No active apisession found.');
                    done();
                });
            });
            it('should fail with 400 if no active subscriptions', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt.url = HOST + '/subscription?action=stop';
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String.and.equal('No active subscriptions.');
                        done();
                    });
                });
            });

            describe('validate unsubscribe options', (): void => {
                it('should fail with 409 if body has no correlationId', (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?action=stop',
                            body: [],
                            json: true,
                            agentOptions: aOpts
                        };
                        request.post(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(409);
                            body.message.should.be.a.String.and.equal('Invalid unsubscribe data.');
                            done();
                        });
                    });
                });
                it('should fail with 409 if correlationId is not array',
                   (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?action=stop',
                            body: { correlationIds: 1 },
                            json: true,
                            agentOptions: aOpts
                        };
                        request.post(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(409);
                            body.message.should.be.a.String.and.equal('Invalid unsubscribe data.');
                            done();
                        });
                    });
                });
                it('should fail with 409 if correlationIds is a empty array',
                   (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?action=stop',
                            body: { correlationIds: [] },
                            json: true,
                            agentOptions: aOpts
                        };
                        request.post(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(409);
                            body.message.should.be.a.String.and.equal('Invalid unsubscribe data.');
                            done();
                        });
                    });
                });
                it('should fail with 409 if some correlationIds are invalid',
                   (done: Function): void => {
                    var opt: any = {
                        url: HOST + '/subscription?action=start',
                        body: [
                                  { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                                  { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                              ],
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        opt = {
                            url: HOST + '/subscription?action=stop',
                            body: { correlationIds: [2] },
                            json: true,
                            agentOptions: aOpts
                        };
                        request.post(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(409);
                            body.message.should.be.a.String
                                .and.equal('Invalid correlation Id 2 received.');
                            done();
                        });
                    });
                });
            });

            it('should unsubscribe all if body is empty', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    body: [
                              { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                              { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt = {
                        url: HOST + '/subscription?action=stop',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        body.message.should.be.a.String.and.equal('Unsubscribed Successfully');
                        body.status.should.be.a.Number.and.equal(0);
                        body.correlationIds.sort().should.be.an.Array.and.eql([0, 1]);
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(400);
                            body.message.should.be.a.String.and.equal('No active subscriptions.');
                            done();
                        });
                    });
                });
            });
            it('should unsubscribe all if specify all cids', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    body: [
                              { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                              { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt = {
                        url: HOST + '/subscription?action=stop',
                        body: { correlationIds: [0, 1] },
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        body.message.should.be.a.String.and.equal('Unsubscribed Successfully');
                        body.status.should.be.a.Number.and.equal(0);
                        body.correlationIds.sort().should.be.an.Array.and.eql([0, 1]);
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(400);
                            body.message.should.be.a.String.and.equal('No active subscriptions.');
                            done();
                        });
                    });
                });
            });
            it('should unsubscribe part if one cid', (done: Function): void => {
                var cid: number;
                ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                    cid = subscriptions[0].correlation;
                });
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    body: [
                              { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                              { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt = {
                        url: HOST + '/subscription?action=stop',
                        body: { correlationIds: [1] },
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        body.message.should.be.a.String.and.equal('Unsubscribed Successfully');
                        body.status.should.be.a.Number.and.equal(0);
                        body.correlationIds.sort().should.be.an.Array.and.eql([1]);
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        ipc.emit(util.format('subscription-%d-MarketDataEvents', cid));
                        request.get(opt, (error: Error, response: any, body: any): void => {
                            should.ifError(error);
                            response.statusCode.should.be.a.Number.and.equal(200);
                            response.headers.should.have.property('content-type')
                                .equal('application/json');
                            body.status.should.be.a.Number.and.equal(0);
                            body.message.should.be.a.String.and.equal('OK');
                            body.data.should.be.an.Array.and.have.length(1);
                            body.data[0].should.be.an.Array.and.have.length(1);
                            body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                            body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                            body.data[0][0].data.should.eql(['TestData']);
                            done();
                        });
                    });
                });
            });
            it('should unsubscribe with buffered data', (done: Function): void => {
                ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                    ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                         subscriptions[0].correlation));
                    ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                         subscriptions[1].correlation));
                });
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    body: [
                              { security: '//blp/mktdata', correlationId: 0, fields: ['P'] },
                              { security: '//blp/mktdata', correlationId: 1, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    opt = {
                        url: HOST + '/subscription?action=stop',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        response.headers.should.have.property('content-type')
                            .equal('application/json');
                        body.status.should.be.a.Number.and.equal(0);
                        body.message.should.be.a.String.and.equal('Unsubscribed Successfully');
                        body.correlationIds.sort().should.be.an.Array.and.eql([0, 1]);
                        body.data.should.be.an.Array.and.have.length(1);
                        body.data[0].should.be.an.Array.and.have.length(2);
                        body.data[0][0].correlationId.should.be.a.Number.and.equal(0);
                        body.data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                        body.data[0][0].data.should.eql(['TestData']);
                        body.data[0][1].correlationId.should.be.a.Number.and.equal(1);
                        body.data[0][1].missed_ticks.should.be.a.Number.and.equal(0);
                        body.data[0][1].data.should.eql(['TestData']);
                        done();
                    });
                });
            });
            it('should reset poll id after unsubscribe all', (done: Function): void => {
                ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                    ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                         subscriptions[0].correlation));
                });
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    body: [
                              { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                // Subscribe
                (Promise.promisify(request.post))(opt)
                    // poll
                    .then((): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=3',
                            json: true,
                            agentOptions: aOpts
                        };
                        return (Promise.promisify(request.get))(opt);
                    })
                    // unsubscribe
                    .then((): void => {
                        opt = {
                            url: HOST + '/subscription?action=stop',
                            json: true,
                            agentOptions: aOpts
                        };
                        return (Promise.promisify(request.post))(opt);
                    })
                    // resubscribe
                    .then((): void => {
                        ipc.once('wait-to-subscribe', (subscriptions: any): void => {
                            ipc.emit(util.format('subscription-%d-MarketDataEvents',
                                                 subscriptions[0].correlation));
                        });
                        opt = {
                            url: HOST + '/subscription?action=start',
                            body: [
                                      { security: 'A', correlationId: 0, fields: ['P'] }
                                  ],
                            json: true,
                            agentOptions: aOpts
                        };
                        return (Promise.promisify(request.post))(opt);
                    })
                    // poll
                    .then((): void => {
                        opt = {
                            url: HOST + '/subscription?pollid=0',
                            json: true,
                            agentOptions: aOpts
                        };
                        return (Promise.promisify(request.get))(opt);
                    })
                    // verify
                    .then((data: any): void => {
                        data[0].statusCode.should.be.a.Number.and.equal(200);
                        data[0].headers.should.have.property('content-type')
                            .equal('application/json');
                        data[1].status.should.be.a.Number.and.equal(0);
                        data[1].message.should.be.a.String.and.equal('OK');
                        data[1].data.should.be.an.Array.and.have.length(1);
                        data[1].data[0].should.be.an.Array.and.have.length(1);
                        data[1].data[0][0].correlationId.should.be.a.Number.and.equal(0);
                        data[1].data[0][0].missed_ticks.should.be.a.Number.and.equal(0);
                        data[1].data[0][0].data.should.eql(['TestData']);
                        done();
                    })
                    .catch((err: Error): any => {
                        done(err);
                    });
            });
        });

        describe('#session terminated', (): void => {
            it('should remove all subscriptions', (done: Function): void => {
                var opt: any = {
                    url: HOST + '/subscription?action=start',
                    body: [
                              { security: '//blp/mktdata', correlationId: 0, fields: ['P'] }
                          ],
                    json: true,
                    agentOptions: aOpts
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    ipc.emit('terminate-session');
                    opt = {
                        url: HOST + '/subscription?pollid=0',
                        json: true,
                        agentOptions: aOpts
                    };
                    request.get(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        body.message.should.be.a.String.and.equal('No active subscriptions.');
                        done();
                    });
                });
            });
        });
    });
});
