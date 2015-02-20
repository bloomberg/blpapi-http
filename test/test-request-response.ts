/// <reference path='../typings/tsd.d.ts' />

import child = require('child_process');
import Promise = require('bluebird');
import should = require('should');
import request = require('request');
import TestHelper = require('../lib/test-infrastructure/test-helper');
import MockWrapper = require('../lib/test-infrastructure/mock-blpapi-wrapper');
should(true).ok;    // Added so ts won't get rid of should module

var HOST = 'http://localhost:3000';

describe('Request/Response', (): void => {
    describe('blpSession start successfully, send data in 1 trunk', (): void => {
        var instruction: MockWrapper.IInstruction = {
            start: true,
            request: ['sendFinalData']
        };
        var p: Promise<child.ChildProcess>;

        // Create test server
        before((): Promise<child.ChildProcess> => {
            p = TestHelper.startServer(instruction);
            return p;
        });

        describe('#accept-header', (): void => {
            it('should fail with 406 if accept header is not json', (done: Function): void => {
                request.post({
                    url: HOST + '/requests',
                    body:  {},
                    json: true,
                    headers: { accept: 'application/xml' }
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(406);
                    done();
                });
            });
        });

        describe('#body-size', (): void => {
            it('should fail with 413 if body size exceeds 1024 byte', (done: Function): void => {
                var s: String;
                for (var i = 0; i < 1025; i++) {
                    s += 'x';
                }
                request.post({
                    url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                    body:  {test: s},
                    json: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(413);
                    done();
                });
            });
        });

        describe('#compression', (): void => {
            it('should gzip compress response data', (done: Function): void => {
                request.post({
                    url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                    body:  {},
                    json: true,
                    gzip: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(200);
                    response.headers.should.have.property('content-type').equal('application/json');
                    response.headers.should.have.property('content-encoding').equal('gzip');
                    done();
                });
            });
        });

        describe('#url-resource', (): void => {
            it('should fail with 404 if url resource is wrong', (done: Function): void => {
                request.post({
                    url: HOST + '/requests',
                    body:  {},
                    json: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(404);
                    done();
                });
            });
        });

        describe('#url-resource', (): void => {
            it('should fail with 400 if query params are all missing', (done: Function): void => {
                request.post({
                    url: HOST + '/request',
                    body:  {},
                    json: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });
            it('should fail with 400 if param "ns" is missing', (done: Function): void => {
                request.post({
                    url: HOST + '/request?service=refdata&type=HistoricalDataRequest',
                    body:  {},
                    json: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });
            it('should fail with 400 if param "service" is missing', (done: Function): void => {
                request.post({
                    url: HOST + '/request?ns=blp&type=HistoricalDataRequest',
                    body:  {},
                    json: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });
            it('should fail with 400 if param "type" is missing', (done: Function): void => {
                request.post({
                    url: HOST + '/request?ns=blp&service=refdata',
                    body:  {},
                    json: true
                }, (error: Error, response: any, body: any): void => {
                    should.ifError(error);
                    response.statusCode.should.be.a.Number.and.equal(400);
                    done();
                });
            });
        });

        it('should succeed with 200 and expected response', (done: Function): void => {
            request.post({
                url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                body: {},
                json: true
            }, (error: Error, response: any, body: any): void => {
                should.ifError(error);
                response.statusCode.should.be.a.Number.and.equal(200);
                response.headers.should.have.property('content-type').equal('application/json');
                body.status.should.be.a.Number.and.equal(0);
                body.message.should.be.a.String.and.equal('OK');
                body.data.should.be.an.Array.and.have.length(1);
                body.data.should.eql(['FinalTestData']);
                done();
            });
        });

        // Shut-down server
        after((): Promise<void> => {
            return TestHelper.stopServer(p);
        });
    });

    describe('blpSession cannot be started', (): void => {
        var instruction: MockWrapper.IInstruction = {
            start: false,
            request: ['sendPartialData', 'sendPartialData', 'sendFinalData']
        };
        var p: Promise<child.ChildProcess>;

        // Create test server
        before((): Promise<child.ChildProcess> => {
            p = TestHelper.startServer(instruction);
            return p;
        });

        it('should fail with 500 if blpSession cannot be started', (done: Function): void => {
            request.post({
                url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                body:  {},
                json: true
            }, (error: Error, response: any, body: any): void => {
                should.ifError(error);
                response.statusCode.should.be.a.Number.and.equal(500);
                done();
            });
        });

        // Shut-down server
        after((): Promise<void> => {
            return TestHelper.stopServer(p);
        });
    });

    describe('blpSession start successfully, send data in 3 trunk', (): void => {
        var instruction: MockWrapper.IInstruction = {
            start: true,
            request: ['sendPartialData', 'sendPartialData', 'sendFinalData']
        };
        var p: Promise<child.ChildProcess>;

        // Create test server
        before((): Promise<child.ChildProcess> => {
            p = TestHelper.startServer(instruction);
            return p;
        });

        it('should succeed with 200 and expected response', (done: Function): void => {
            request.post({
                url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                body: {},
                json: true
            }, (error: Error, response: any, body: any): void => {
                should.ifError(error);
                response.statusCode.should.be.a.Number.and.equal(200);
                response.headers.should.have.property('content-type').equal('application/json');
                body.status.should.be.a.Number.and.equal(0);
                body.message.should.be.a.String.and.equal('OK');
                body.data.should.be.an.Array.and.have.length(3);
                body.data.should.eql(['TestData', 'TestData', 'FinalTestData']);
                done();
            });
        });

        // Shut-down server
        after((): Promise<void> => {
            return TestHelper.stopServer(p);
        });
    });

    describe('blpSession start successfully, send 1 trunk data then hang', (): void => {
        var instruction: MockWrapper.IInstruction = {
            start: true,
            request: ['sendPartialData']
        };
        var p: Promise<child.ChildProcess>;

        // Create test server
        before((): Promise<child.ChildProcess> => {
            p = TestHelper.startServer(instruction);
            return p;
        });

        // Use function instead of lambda expression to avoid ts capturing "this" in a variable
        it('should timeout after 2000ms', function(done: Function): void {
            var EXPECTED_TIMEOUT: number = 2000;
            var p2: Promise<void>;
            this.timeout(EXPECTED_TIMEOUT + 100);
            var timeout = setTimeout((): void => {
                p2.cancel();
                done();
            }, EXPECTED_TIMEOUT);
            p2 = (Promise.promisify(request.post))({
                url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                body: {},
                json: true
            })
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

        // Shut-down server
        after((): Promise<void> => {
            return TestHelper.stopServer(p);
        });
    });

    describe('blpSession start successfully, send error when request arrives', (): void => {
        var instruction: MockWrapper.IInstruction = {
            start: true,
            request: ['sendError']
        };
        var p: Promise<child.ChildProcess>;

        // Create test server
        before((): Promise<child.ChildProcess> => {
            p = TestHelper.startServer(instruction);
            return p;
        });

        it('should fail with 500 if error occurs', (done: Function): void => {
            request.post({
                url: HOST + '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
                body:  {},
                json: true
            }, (error: Error, response: any, body: any): void => {
                should.ifError(error);
                response.statusCode.should.be.a.Number.and.equal(500);
                done();
            });
        });

        // Shut-down server
        after((): Promise<void> => {
            return TestHelper.stopServer(p);
        });
    });

    // TODO: Add test cases of SessionTerminated once we reach an agreement on how to handle
    // chunked response
});
