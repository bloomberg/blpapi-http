// usage: node MarketDataSubscription.js [<host>]
var io = require('socket.io-client');
var fs = require('fs');

var host = process.argv[2] || 'http-api.openbloomberg.com';
var port = 3001;
var ns = 'subscription';
var url = host + ':' + port + '/' + ns;
var opt = {
    secure: true,
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    ca: fs.readFileSync('bloomberg.crt')
};
var NUM = 2; // Number of subscription data received before unsubscribe
var counter = 0;
var unsubscribedCounter = 0;

var socket = io.connect(url, opt);

var subscriptions = [
    { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] },
    { security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
];

socket.on('connected', function () {
    counter = 0;
    console.log('Connected');
    socket.emit('subscribe', subscriptions);
});

socket.on('data', function (data) {
    console.log('Data Count: ' + counter++);
    console.log(data);
    if (counter === NUM) {
        socket.emit('unsubscribe');
        // Unsubscribe only partial subscription
        //socket.emit('unsubscribe', { correlationIds: [1] });
    }
});

socket.on('err', function (data) {
    console.log(data);
});

socket.on('subscribed', function (correlationIds) {
    console.log('Subscribed');
    console.log('Correlation Ids: ' + correlationIds);
});

socket.on('unsubscribed', function (correlationIds) {
    console.log('Unsubscribed');
    console.log('Correlation Ids: ' + correlationIds);
    unsubscribedCounter += correlationIds.length;
    if (unsubscribedCounter === subscriptions.length) {
        socket.disconnect();
        process.exit();
    }
});

socket.on('disconnect', function() {
    console.log('Socket Disconnected.');
    process.exit();
});

