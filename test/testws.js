var WebSocket = require('ws');
var fs = require('fs');
var path = require('path');
var cluster = require('cluster');

var host = 'wss://localhost:3002';
var caFile = path.resolve(__dirname, '../keys/bloomberg-ca-crt.pem');
var keyFile = path.resolve(__dirname, '../keys/client-key.pem');
var certFile = path.resolve(__dirname, '../keys/client-crt.pem');
var opt = {
                cert: fs.readFileSync(certFile),
                key: fs.readFileSync(keyFile),
                ca: fs.readFileSync(caFile),
                rejectUnauthorized: false
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

    var socket = new WebSocket(host, opt);

    function prepare(type, data) {
            return JSON.stringify({'type': type, 'data': data});
    }

    socket.on('open', function() {
        counter = 0;
        console.log('Socket Connected. Client Id: ' + clientId);
        socket.send(prepare('subscribe',
                    [
                        { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] }
                        //{ security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
                    ]
        ));
    });

    socket.on('message', function(message) {
        var obj = JSON.parse(message);

        switch(obj.type) {
            case 'data': {
                console.log('Data Count: ' + counter++);
                if (PRINT_OUTPUT) {
                    console.log(obj.data);
                }

                if (counter === NUM) {
                    //socket.emit('unsubscribe', { correlationIds: [0, 1] });
                    socket.send(prepare('unsubscribe'))
                }
                break;
            }
            case 'subscribed': {
                console.log('Subscribed');
                break;
            }
            case 'unsubscribed': {
                console.log('Unsubscribed');
                break;
            }
            case 'unsubscribed all': {
                console.log('Unsubscribed all');
                socket.close();
                break;
            }
            case 'err': {
                console.log('Error received: ');
                console.log(obj.data);
                break;
            }
            default: {
                console.log('Invalid message type: ' + obj.type);
                socket.close();
            }
        }
    });

    socket.on('close', function() {
        console.log('Socket Disconnected.');
    });
}
