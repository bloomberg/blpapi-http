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


var TRANSITION = {
    STARTED: 'started'
  , STOPPED: 'stopped'
}

// ANONYMOUS FUNCTION
function validateAndTransitionState(state, desiredTransition) {
    if (desiredTransition in state) {
        throw new Error("session is already " + desiredTransition);
    }
    else if (TRANSITION.STOPPED in state &&
             TRANSITION.STARTED === desiredTransition)
    {
        throw new Error('session is unable to be restarted once stopped');
    }
    else if (!(TRANSITION.STARTED in state) &&
             TRANSITION.STOPPED === desiredTransition)
    {
        throw new Error('session has not been started');
    }
    state[desiredTransition] = true;
}

// PRIVATE MANIPULATORS
function listen(eventName, expectedId, handler) {
    if (!(eventName in this.listeners)) {
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
    delete this.listeners[eventName][correlatorId];
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
    this.state = {};
    this.listeners = {};
    this.correlatorId = 0;
    this.services = {};
    this.session = new F(arguments);
}

// MANIPULATORS
Session.prototype.start = function(cb) {
    validateAndTransitionState(this.state, TRANSITION.STARTED);

    return new Promise((function(resolve, reject) {
        var listener = function(listenerName, handler, ev) {
            this.session.removeAllListeners(listenerName);
            handler(ev);
        }

        this.session.once('SessionStarted',
                          listener.bind(this,
                                        'SessionStartupFailure',
                                         resolve));
        this.session.once('SessionStartupFailure',
                          listener.bind(this, 'SessionStarted', reject));

        this.session.start();
    }).bind(this)).nodeify(cb);
};


Session.prototype.stop = function(cb) {
    validateAndTransitionState(this.state, TRANSITION.STOPPED);
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
            reject(new Error(ev.data.reason.description));
        }).bind(this));

        debug('Opening service:', uri);
        this.session.openService(uri, openServiceId);
    }).bind(this)).bind(this); // end 'new Promise'

    thenable.then(function() {
        var responseEventName = name + 'Response'
        var correlatorId = this.correlatorId++;
        listen.call(this,
                    responseEventName,
                    correlatorId,
                    requestHandler.bind(this, callback));
        this.session.request(uri, name + 'Request', request, correlatorId);
    }, function(ex) {
        callback(ex);
    });
};

// ACCESSORS
Session.prototype.isStopped = function() {
    return (TRANSITION.STOPPED in this.state);
};
