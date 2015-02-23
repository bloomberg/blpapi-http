/// <reference path='../../typings/tsd.d.ts' />

// Setup mock blpapi-wrapper
import assert = require('assert');
import mockery = require('mockery');
import MockWrapper = require('./mock-blpapi-wrapper');

mockery.registerMock('../blpapi-wrapper', MockWrapper);
mockery.enable({
    useCleanCache: true,
    warnOnReplace: true,
    warnOnUnregistered: false
});
process.on('exit', (): void => {
    mockery.deregisterAll();
    mockery.disable();
});

// Run actual index.js
import index = require('../../index');

assert(index);  // Have this line so ts will detect a usage of index module
