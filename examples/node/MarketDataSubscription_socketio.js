// usage: node MarketDataSubscription_socketio.js [<host> [<port>]]

var fs = require('fs');
var util = require('util');
var io = require('socket.io-client');

var N_DATA_EVENTS = 2; // Number of subscription data received before unsubscribe

var SUBSCRIPTIONS = [
    { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] },
    { security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
];

// main
var argv = process.argv.slice(2);
var host = (argv.length > 0) ? argv[0] : 'http-api.openbloomberg.com';
var port = (argv.length > 1) ? argv[1] : 8081;
var ns = 'subscription';

var url = util.format('%s:%s/%s', host, port, ns);
var opt = {
    secure: true,
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    ca: fs.readFileSync('bloomberg.crt')
};

var socket = io.connect(url, opt);

socket.on('connect', function () {
    console.log('Connected');
    socket.emit('subscribe', SUBSCRIPTIONS);
});

var data_events_count = 0;
socket.on('data', function (data) {
    console.log(data);
    if (++data_events_count === N_DATA_EVENTS) {
        socket.emit('unsubscribe');
    }
});

socket.on('subscribed', function (correlationIds) {
    console.log('Subscribed:', correlationIds);
});

var unsubscribe_count = 0;
socket.on('unsubscribed', function (correlationIds) {
    console.log('Unsubscribed:', correlationIds);
    unsubscribe_count += correlationIds.length;
    if (SUBSCRIPTIONS.length === unsubscribe_count) {
        socket.disconnect();
    }
});

socket.on('disconnect', function() {
    console.log('Socket Disconnected.');
    process.exit();
});

socket.on('err', function (data) {
    console.log(data);
    socket.disconnect();
    process.exit();
});
