/// <reference path='../typings/tsd.d.ts' />

import child = require('child_process');
import util = require('util');
import Promise = require('bluebird');
import _ = require('lodash');
import should = require('should');
import request = require('request');
import TestHelper = require('./lib/test-helper');
should(true).ok;    // Added so ts won't get rid of should module

var HOST = 'http://localhost:3000';

describe('Request/Response', (): void => {
    var server: child.ChildProcess;
    var ipc: TestHelper.IOurSocket;

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
            var opt = {
                url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                body:  {},
                json: true
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

        describe('service open failure', (): void => {
            before((): void => {
                ipc.on('wait-to-openService', (data: any): void => {
                    ipc.emit(util.format('openService-%d-fail', data.cid));
                });
            });

            after((): void => {
                ipc.off('wait-to-openService');
            });

            it('should fail with 500 if service cannot be opened', (done: Function): void => {
                var opt = {
                    url: HOST + '/request?ns=blpp&service=refdata&type=HistoricalDataRequest',
                    body:  {},
                    json: true
                };
                request.post(opt, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(500);
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

            describe('request data arrives in 1 trunk', (): void => {
                beforeEach((): void => {
                    ipc.once('wait-to-request', (data: any): void => {
                        ipc.emit(util.format('request-%d-final', data.cid));
                    });
                });

                it('should fail with 406 if accept header is not json', (done: Function): void => {
                    var opt: request.Options = {
                        url: HOST + '/requests',
                        body:  {},
                        json: true,
                        headers: { 'accept': 'application/xml' }
                    };
                    request.post(opt,
                                 (error: Error, response: any, body: any): void => {
                                     should.ifError(error);
                                     response.statusCode.should.be.a.Number.and.equal(406);
                                     done();
                                 });
                });
                it('should fail with 413 if body exceeds 1024 byte', (done: Function): void => {
                    var s: String;
                    for (var i = 0; i < 1025; i++) {
                        s += 'x';
                    }
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body:  {test: s},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(413);
                        done();
                    });
                });
                it('should gzip compress response data', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body:  {},
                        json: true,
                        gzip: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        response.headers.should.have.property('content-type')
                            .equal('application/json');
                        response.headers.should.have.property('content-encoding').equal('gzip');
                        done();
                    });
                });
                it('should fail with 404 if url resource is wrong', (done: Function): void => {
                    var opt = {
                        url: HOST + '/requests',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(404);
                        done();
                    });
                });
                it('should fail with 400 if query params are missing', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        done();
                    });
                });
                it('should fail with 400 if param "ns" is missing', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?service=refdata&type=HistoricalDataRequest',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        done();
                    });
                });
                it('should fail with 400 if param "service" missing', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&type=HistoricalDataRequest',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        done();
                    });
                });
                it('should fail with 400 if param "type" is missing', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(400);
                        done();
                    });
                });
                it('should succeed with 200 and expected response', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body: {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        response.headers.should.have.property('content-type')
                            .equal('application/json');
                        body.status.should.be.a.Number.and.equal(0);
                        body.message.should.be.a.String.and.equal('OK');
                        body.data.should.be.an.Array.and.have.length(1);
                        body.data.should.eql(['FinalTestData']);
                        done();
                    });
                });
            });

            describe('request data arrives in 3 trunk', (): void => {
                beforeEach((): void => {
                    ipc.once('wait-to-request', (data: any): void => {
                        ipc.emit(util.format('request-%d-partial', data.cid));
                        ipc.emit(util.format('request-%d-partial', data.cid));
                        ipc.emit(util.format('request-%d-final', data.cid));
                    });
                });

                it('should succeed with 200 and expected response', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body: {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        response.headers.should.have.property('content-type')
                            .equal('application/json');
                        body.status.should.be.a.Number.and.equal(0);
                        body.message.should.be.a.String.and.equal('OK');
                        body.data.should.be.an.Array.and.have.length(3);
                        body.data.should.eql(['TestData', 'TestData', 'FinalTestData']);
                        done();
                    });
                });
            });

            describe('request data arrives in 1 trunk then hang', (): void => {
                var cids: number[] = [];
                beforeEach((): void => {
                    ipc.once('wait-to-request', (data: any): void => {
                        cids.push(data.cid);
                        ipc.emit(util.format('request-%d-partial', data.cid));
                    });
                });

                after((): void => {
                    _.forEach(cids, (cid: number): void => {
                        ipc.emit(util.format('request-%d-final', cid));
                    });
                });

                // Use function instead of lambda to avoid ts capturing "this" in a variable
                it('should timeout after 2000ms', function(done: Function): void {
                    var EXPECTED_TIMEOUT: number = 2000;
                    var p: Promise<void>;
                    this.timeout(EXPECTED_TIMEOUT + 100);
                    var timeout = setTimeout((): void => {
                                                p.cancel();
                                                done();
                                             },
                                             EXPECTED_TIMEOUT);
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body: {},
                        json: true
                    };
                    p = (Promise.promisify(request.post))(opt)
                        .then((): void => {
                            clearTimeout(timeout);
                            done(new Error('Timeout did not happen!'));
                        })
                        .cancellable()
                        .catch(Promise.CancellationError, (err: Error): void => {
                            // Do nothing, this is expected
                        })
                        .catch((err: Error): void => {
                            done(err);
                        });
                });
            });

            describe('request type is not in internal map', (): void => {
                it('should fail with 500 if request type is invalid', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=FutureDataRequest',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(500);
                        done();
                    });
                });
            });

            describe('request error out immediately', (): void => {
                // Set instructions
                before((): Promise<void> => {
                    return ipc.emitAcknowledge('set-instructions', { request: ['throwError'] });
                });

                // Clear instructions
                after((): Promise<void> => {
                    return ipc.emitAcknowledge('clear-instructions', ['request']);
                });

                it('should fail with 500 if error occur', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(500);
                        done();
                    });
                });
            });

            describe('session terminated before request arrive', (): void => {
                beforeEach((): void => {
                    ipc.emit('terminate-session');
                    ipc.once('wait-to-request', (data: any): void => {
                        ipc.emit(util.format('request-%d-final', data.cid));
                    });
                });

                it('should succeed with 200 and expected response', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body: {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        response.headers.should.have.property('content-type')
                            .equal('application/json');
                        body.status.should.be.a.Number.and.equal(0);
                        body.message.should.be.a.String.and.equal('OK');
                        body.data.should.be.an.Array.and.have.length(1);
                        body.data.should.eql(['FinalTestData']);
                        done();
                    });
                });
            });

            describe('session terminated when request arrive', (): void => {
                beforeEach((): void => {
                    ipc.once('wait-to-request', (data: any): void => {
                        ipc.emit('terminate-session');
                    });
                });

                it('should fail with 500 with error message', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(500);
                        done();
                    });
                });
            });

            describe('request data arrives in 1 trunk then session ternimated', (): void => {
                beforeEach((): void => {
                    ipc.once('wait-to-request', (data: any): void => {
                        ipc.emit(util.format('request-%d-partial', data.cid));
                        ipc.emit('terminate-session');
                    });
                });

                it('should succeed with 200 with error message', (done: Function): void => {
                    var opt = {
                        url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                        body:  {},
                        json: true
                    };
                    request.post(opt, (error: Error, response: any, body: any): void => {
                        should.ifError(error);
                        response.statusCode.should.be.a.Number.and.equal(200);
                        response.headers.should.have.property('content-type')
                            .and.equal('application/json');
                        body.status.should.be.a.Number.and.equal(-1);
                        body.message.should.be.a.String.and.equal('session terminated');
                        body.data.should.be.an.Array.and.have.length(1);
                        body.data.should.eql(['TestData']);
                        done();
                    });
                });
            });
        });
    });
});
