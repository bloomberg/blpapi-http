var assert = require('assert');
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

function requestHandler(cb, m) {
    var eventType = m.eventType;
    var isFinal = (EVENT_TYPE.RESPONSE === eventType);

    cb(null, m.data, isFinal);

    if (isFinal) {
        var correlatorId = m.correlations[0].value;
        var messageType = m.messageType;
        unlisten.call(this, messageType, correlatorId);
    }
}

// CREATORS
function Session() {
    // wrapper to apply 'arguments' to blpapi.Session
    function F(args) {
        return blpapi.Session.apply(this, args)
    }
    F.prototype = blpapi.Session.prototype;

    // PRIVATE DATA
    this.listeners = {};
    this.correlatorId = 0;
    this.services = {};
    this.session = new F(arguments);
}

// MANIPULATORS
Session.prototype.start = function(cb) {
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
    return new Promise((function(resolve, reject) {
        this.session.stop();
        this.session.once('SessionTerminated', (function(ev) {
            this.session.destroy();
            resolve();
        }).bind(this));
    }).bind(this)).nodeify(cb);
};

Session.prototype.request = function(uri, name, request, callback) {
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
                    requestHandler.bind(this, callback));
    }).catch(function(ex) {
        callback(ex);
    });
};
