/// <reference path='../../typings/tsd.d.ts' />

import assert = require('assert');
import http = require('http');
import mockery = require('mockery');
import _ = require('lodash');
import sio = require('socket.io');
import optimist = require('optimist');
import MockBLPAPI = require('./mock-blpapi');

// Setup mock of blpapi
mockery.registerMock('blpapi', MockBLPAPI);
mockery.enable({
    useCleanCache: true,
    warnOnReplace: true,
    warnOnUnregistered: false
});
// Need to import server after mockery is setup
import server = require('../../lib/server');

// Setup an Socket.IO server for IPC need
var s: http.Server = http.createServer();
var port = optimist.argv.testport || 3333;   // Default port of ipc is 3333
s.listen(port);
s.on('listening', (): void => {
    console.log('ipc server listening on port ' + port);
});
var io: SocketIO.Server = sio(s);
io.on('connection', (socket: SocketIO.Socket): void => {
    console.log('ipc channel connected');
    MockBLPAPI.ipc = socket;
    socket.on('set-instructions', (instructions: MockBLPAPI.IInstruction, cb: Function): void => {
        _.forEach(instructions, (i: any, key: string): void => {
            MockBLPAPI.instructions[key] = i;
        });
        cb();
    });
    socket.on('clear-instructions', (arg: string[], cb: Function): void => {
        var instructions = arg || Object.keys(MockBLPAPI.instructions);
        _.forEach(instructions, (s: string): void => {
            delete MockBLPAPI.instructions[s];
        });
        cb();
    });
});

process.on('exit', (): void => {
    mockery.deregisterAll();
    mockery.disable();
    MockBLPAPI.ipc.disconnect(true);
});

// Run actual server.ts

// signal parent process that the server is ready(for testing)
server.startServer()
    .then((): void => {
        process.send('server ready');
    });
