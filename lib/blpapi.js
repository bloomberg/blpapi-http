var assert = require('assert');
var util = require ('util');

var blpapi = require('blpapi');
var Promise = require('bluebird');


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

// PRIVATE MANIPULATORS
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

function openServiceHandler(m) {
    console.log(m);
    var correlatorId = m.correlations[0].value;
    this.services[correlatorId].call(this);
    delete this.services[correlatorId];
}

function requestHandler(m) {
    console.log(m);
    var correlatorId = m.correlations[0].value;
    var eventType = m.eventType;
    var isFinal = (EVENT_TYPE.RESPONSE === eventType);

    assert(correlatorId in this.requests,
           util.format('correlatorId(%d) does not exist', correlatorId));

    this.requests[correlatorId](null, m.data, isFinal);
    if (isFinal) {
        delete this.requests[correlatorId];
    }
}

function makeRequest(uri, name, request, callback) {
        var correlatorId = this.requestId++;
        this.requests[correlatorId] = callback;
        this.session.request(uri, name + 'Request', request, correlatorId);
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

    this.state = {};

    this.serviceId = 0;
    this.services = {};
    this.openServiceHandler = openServiceHandler.bind(this);
    this.openServices = {};

    this.requestId = 0;
    this.requests = {};
    this.requestHandler = requestHandler.bind(this);
    this.requestHandlers = {};
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
        this.session.once('SessionTerminated', resolve);
        this.session.stop();
    }).bind(this)).nodeify(cb);
};


Session.prototype.request = function(uri, name, request, callback) {
    if (name in this.requestHandlers) {
        makeRequest.call(this, uri, name, request, callback);
    } else {
        if (uri in this.openServices) {
            var responseEventName = name + 'Response'
            this.session.on(responseEventName, this.requestHandler);
            this.requestHandlers[name] = true;
            makeRequest.call(this, uri, name, request, callback);
        } else {
            if (0 === Object.keys(this.openServices).length) {
                this.session.on('ServiceOpened', this.openServiceHandler);
            }

            // TODO - need to check and buffer subsequent requests if not
            //        opened yet
            var openServiceId = this.serviceId++;
            this.services[openServiceId] = function() {
                this.openServices[uri] = true;;
                this.request(uri, name, request, callback);
            }
            this.session.openService(uri, openServiceId);
        }
    }
};

// ACCESSORS
Session.prototype.isStopped = function() {
    return (TRANSITION.STOPPED in this.state);
};

