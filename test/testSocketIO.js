var io = require('socket.io-client');
var fs = require('fs');
var path = require('path');
var cluster = require('cluster');

var host = 'https://localhost:3001';
var ns = '/subscription';
var url = host + ns;
var caFile = path.resolve(__dirname, '../keys/bloomberg-ca-crt.pem');
var keyFile = path.resolve(__dirname, '../keys/client-key.pem');
var certFile = path.resolve(__dirname, '../keys/client-crt.pem');
var opt = {
                cert: fs.readFileSync(certFile),
                key: fs.readFileSync(keyFile),
                ca: fs.readFileSync(caFile),
                rejectUnauthorized: false,
                reconnection: false
          };
var NUM = Infinity;
var NUM_CLIENT = 1;
var PRINT_OUTPUT = false;

// Main
if (cluster.isMaster) {
    for (var i = 0; i < NUM_CLIENT; i++) {
      cluster.fork();
    }

    cluster.on('online', function(worker) {
        console.log('Worker ' + worker.process.pid + ' is online.');
    });

    cluster.on('exit', function(worker, code, signal) {
        console.log('worker ' + worker.process.pid + ' died.');
    });
} else {
    socketSubscription(cluster.worker.id);
}

function socketSubscription(clientId) {
    var counter = 0;
    console.log('Client Id: ' + clientId + '. Start testing.');

    var socket = io.connect(url, opt);

    socket.on('connected', function () {
        counter = 0;
        console.log('Connected' + '. Client Id: ' + clientId);
        socket.emit('subscribe',
                    [
                        { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] }
                        //{ security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
                    ]
        );
    });

    socket.on('data', function (data) {
        console.log('Data Count: ' + counter++ + '. Client Id: ' + clientId);
        if (PRINT_OUTPUT) {
            console.log(data);  
        }
        if (counter === NUM) {
            //socket.emit('unsubscribe', { correlationIds: [0, 1] });
            socket.emit('unsubscribe');
        }
    });

    socket.on('err', function (data) {
        console.log(data);
    });

    socket.on('subscribed', function () {
        console.log('Subscribed' + '. Client Id: ' + clientId);
    });

    socket.on('unsubscribed', function () {
        console.log('Unsubscribed' + '. Client Id: ' + clientId);
    });

    socket.on('unsubscribed all', function () {
        console.log('Unsubscribed all' + '. Client Id: ' + clientId);
        socket.disconnect();
        process.exit();
    });

    socket.on('disconnect', function() {
        console.log('Socket Disconnected.' + '. Client Id: ' + clientId);
        process.exit();
    });
}
