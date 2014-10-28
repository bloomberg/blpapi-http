var assert = require('assert');
var util = require ('util');

var blpapi = require('blpapi');
var Promise = require('bluebird');
var debug = require('debug')('blpapi-wrapper')


module.exports = Session;


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
        debug(util.format("'%s' listener added", eventName));
        this.session.on(eventName, (function(eventName, m) {
            debug(m);
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
        debug(util.format("'%s' listener removed ", eventName));
        this.session.removeAllListeners(eventName);
        delete this.listeners[eventName];
    }
}

function requestHandler(cb, m) {
    debug(m);
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

        this.session.start();
    }).bind(this)).nodeify(cb);
};

Session.prototype.stop = function(cb) {
    return new Promise((function(resolve, reject) {
        this.session.once('SessionTerminated', (function(ev) {
            this.session.destroy();
            resolve();
        }).bind(this));
        this.session.stop();
    }).bind(this)).nodeify(cb);
};

Session.prototype.request = function(uri, name, request, callback) {
    var thenable = this.services[uri] = this.services[uri] ||
                                        new Promise((function(resolve, reject) {
        var openServiceId = this.correlatorId++;

        listen.call(this, 'ServiceOpened', openServiceId,  (function(ev) {
            unlisten.call(this, 'ServiceOpened', openServiceId)
            unlisten.call(this, 'ServiceOpenFailure', openServiceId);
            resolve();
        }).bind(this));

        listen.call(this, 'ServiceOpenFailure', openServiceId,  (function(ev) {
            unlisten.call(this, 'ServiceOpened', openServiceId)
            unlisten.call(this, 'ServiceOpenFailure', openServiceId);
            delete this.services[uri]
            reject(createApiError(ev.data));
        }).bind(this));

        this.session.openService(uri, openServiceId);
    }).bind(this)).bind(this); // end 'new Promise'

    thenable.then(function() {
        var responseEventName = name + 'Response'
        var correlatorId = this.correlatorId++;
        listen.call(this,
                    responseEventName,
                    correlatorId,
                    requestHandler.bind(this, callback));
        try {
            this.session.request(uri, name + 'Request', request, correlatorId);
        } catch (ex) {
            unlisten.call(this, responseEventName, correlatorId);
            callback(ex);
        }
    }, function(ex) {
        callback(ex);
    });
};
