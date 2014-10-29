var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require ('util');

var blpapi = require('blpapi');
var Promise = require('bluebird');
var debug = require('debug');


module.exports = Session;

// LOGGING
trace = debug('blpapi-wrapper:trace');

// CONSTANTS
var EVENT_TYPE = {
    RESPONSE:         'RESPONSE'
  , PARTIAL_RESPONSE: 'PARTIAL_RESPONSE'
};

// ANONYMOUS FUNCTION
function createApiError(data) {
    var ex = new Error(data.reason.description);
    ex.data = data;
    return ex;
}

function isObjectEmpty(obj) {
    return (0 === Object.getOwnPropertyNames(obj).length);
}

// PRIVATE MANIPULATORS
function listen(eventName, expectedId, handler) {
    if (!(eventName in this.listeners)) {
        trace(util.format("'%s' listener added", eventName));
        this.session.on(eventName, (function(eventName, m) {
            trace(m);
            var correlatorId = m.correlations[0].value;
            this.listeners[eventName][correlatorId](m);
        }).bind(this, eventName));

        this.listeners[eventName] = {};
    }
    this.listeners[eventName][expectedId] = handler;
}

function unlisten(eventName, correlatorId) {
    delete this.listeners[eventName][correlatorId]
    if (isObjectEmpty(this.listeners[eventName])) {
        trace(util.format("'%s' listener removed ", eventName));
        this.session.removeAllListeners(eventName);
        delete this.listeners[eventName];
    }
}

function requestHandler(cb, requestId, m) {
    var eventType = m.eventType;
    var isFinal = (EVENT_TYPE.RESPONSE === eventType);

    cb(null, m.data, isFinal);

    if (isFinal) {
        var correlatorId = m.correlations[0].value;
        var messageType = m.messageType;
        delete this.requests[requestId];
        unlisten.call(this, messageType, correlatorId);
    }
}

function sessionTerminatedHandler(ev) {
    trace(ev);

    // clean up listeners
    Object.getOwnPropertyNames(this.listeners).forEach(function(eventName) {
        this.session.removeAllListeners(eventName);
    }, this);
    this.listeners = {};

    // tear down the session
    this.session.destroy();
    this.session = null;

    // notify pending requests that the session has been terminated
    Object.getOwnPropertyNames(this.requests).forEach(function(key) {
        var callback = this.requests[key];
        callback(new Error('session terminated'));
    }, this);
    this.requests = {};

    // emit event to any listeners
    this.emit('SessionTerminated', ev.data);
}

// CREATORS
function Session() {
    // wrapper to apply 'arguments' to blpapi.Session
    function F(args) {
        return blpapi.Session.apply(this, args)
    }
    F.prototype = blpapi.Session.prototype;

    // PRIVATE DATA
    this.session = new F(arguments);
    this.listeners = {};
    this.requests = {};
    this.services = {};
    this.correlatorId = 0;
    this.requestId = 0;

    this.session.once('SessionTerminated', sessionTerminatedHandler.bind(this));
}
util.inherits(Session, EventEmitter);

// MANIPULATORS
Session.prototype.start = function(cb) {
    if (null === this.session) {
        throw new Error('session terminated');
    }

    return new Promise((function(resolve, reject) {
        this.session.start();

        var listener = function(listenerName, handler, ev) {
            this.session.removeAllListeners(listenerName);
            handler(ev.data);
        }

        this.session.once('SessionStarted',
                          listener.bind(this,
                                        'SessionStartupFailure',
                                         resolve));
        this.session.once('SessionStartupFailure',
                          listener.bind(this, 'SessionStarted', function(data){
                                reject(createApiError(data));
                          }));
    }).bind(this)).nodeify(cb);
};

Session.prototype.stop = function(cb) {
    return (null === this.session) ? Promise.resolve() : new Promise((function(resolve, reject) {
        this.session.stop();
        this.session.once('SessionTerminated', (function(ev) {
            resolve();
        }).bind(this));
    }).bind(this)).nodeify(cb);
};

Session.prototype.request = function(uri, name, request, callback) {
    if (null === this.session) {
        return process.nextTick(callback.bind(null, new Error('session terminated')));
    }

    var requestId = this.requestId++;
    this.requests[requestId] = callback;

    var thenable = this.services[uri] = this.services[uri] ||
                                        new Promise((function(resolve, reject) {
        var openServiceId = this.correlatorId++;

        this.session.openService(uri, openServiceId);

        listen.call(this, 'ServiceOpened', openServiceId, (function(ev) {
            unlisten.call(this, 'ServiceOpened', openServiceId)
            unlisten.call(this, 'ServiceOpenFailure', openServiceId);
            resolve();
        }).bind(this));

        listen.call(this, 'ServiceOpenFailure', openServiceId, (function(ev) {
            unlisten.call(this, 'ServiceOpened', openServiceId)
            unlisten.call(this, 'ServiceOpenFailure', openServiceId);
            delete this.services[uri]
            reject(createApiError(ev.data));
        }).bind(this));
    }).bind(this)).bind(this); // end 'new Promise'

    thenable.then(function() {
        var responseEventName = name + 'Response'
        var correlatorId = this.correlatorId++;
        this.session.request(uri, name + 'Request', request, correlatorId);
        listen.call(this,
                    responseEventName,
                    correlatorId,
                    requestHandler.bind(this, callback, requestId));
    }).catch(function(ex) {
        delete this.requests[requestId];
        callback(ex);
    });
};
