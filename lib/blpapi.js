var blpapi = require('blpapi');

module.exports = Session;

// PRIVATE MANIPULATORS
function openServiceHandler(m) {
    console.log(m);
    var correlatorId = m.correlations[0].value;
    this.services[correlatorId].call(this);
    delete this.services[correlatorId];
}

function requestHandler(m) {
    console.log(m);
    var correlatorId = m.correlations[0].value;
    this.requests[correlatorId](m); // they just need the data
    delete this.requests[correlatorId];
}

function makeRequest(uri, name, request, callback) {
        var correlatorId = this.requestId++;
        this.requests[correlatorId] = callback;
        this.session.request(uri, name, request, correlatorId);
}

// CREATORS
function Session() {
    // wrapper to apply 'arguments' to blpapi.Session
    function F(args) {
        return blpapi.Session.apply(this, args)
    }
    F.prototype = blpapi.Session.prototype;

    // PRIVATE DATA
    this.session = new F(arguments)

    this.serviceId = 0;
    this.services = {};
    this.openServiceHandler = openServiceHandler.bind(this);
    this.openServices = {};

    this.requestId = 0;
    this.requests = {};
    this.requestHandler = requestHandler.bind(this);
    this.requestHandlers = {};

    this.makeRequest = makeRequest;
}

// MANIPULATORS
Session.prototype.start = function(callback) {
    // XXX: Should the session be lazily created here?
    this.session.on('SessionStarted', callback);
    this.session.start();
};

Session.prototype.stop = function(callback) {
    // XXX: Should we reset/tear-down internal state?
    this.session.on('SessionTerminated', (function() {
        this.session.destroy();
        callback();
    }).bind(this));
    this.session.stop();
};

Session.prototype.request = function(uri, name, request, callback) {
    if (name in this.requestHandlers) {
        makeRequest.call(this, uri, name, request, callback);
    } else {
        if (uri in this.openServices) {
            var responseEventName = name + 'Response'
            this.session.on(responseEventName, this.requestHandler);
            this.requestHandlers[name] = true;
            var requestName = name + 'Request';
            makeRequest.call(this, uri, requestName, request, callback);
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

