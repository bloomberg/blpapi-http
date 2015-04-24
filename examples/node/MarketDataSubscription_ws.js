// usage: node MarketDataSubscription_ws.js [<host> [<port]]

var assert = require('assert');
var fs = require('fs');
var util = require('util');
var WebSocket = require('ws');

var N_DATA_EVENTS = 2; // Number of subscription data received before unsubscribe

var SUBSCRIPTIONS = [
    { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] },
    { security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
];

function serialize(type, data) {
    return JSON.stringify({'type': type, 'data': data});
}

var data_events_count = 0;
var unsubscribe_count = 0;
function dispatch(socket, msg) {
    var msg = JSON.parse(msg);
    switch (msg.type) {
      case 'data': {
        console.log(msg.data);
        if (++data_events_count == N_DATA_EVENTS) {
            socket.send(serialize('unsubscribe'));
        }
      } break;
      case 'subscribed': {
        console.log('Subscribed:', msg.data);
      } break;
      case 'unsubscribed': {
        console.log('Unsubscribed:', msg.data);
        unsubscribe_count += msg.data.length;
        if (SUBSCRIPTIONS.length === unsubscribe_count) {
            socket.close();
        }
      } break;
      case 'err': {
        console.log('Error:', msg.data);
        socket.close();
        process.exit();
      } break;
      default: {
        socket.close();
        assert(false, 'unhandled message type');
      }
    }
}

// main
var argv = process.argv.slice(2);
var host = (argv.length > 0) ? argv[0] : 'http-api-host';
var port = (argv.length > 1) ? argv[1] : 8080;

var url = util.format('ws://%s:%s', host, port);
var opt = {
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    ca: fs.readFileSync('bloomberg.crt')
};

var socket = new WebSocket(url, opt);
socket.on('open', function() {
    console.log('Connection opened');
    socket.send(serialize('subscribe', SUBSCRIPTIONS));
});
socket.on('message', dispatch.bind(null, socket));
socket.on('close', function() {
    console.log('Socket disconected');
    process.exit();
});
socket.on('error', function(err) {
    console.log(err);
    process.exit();
});
