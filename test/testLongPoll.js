var Promise = require("bluebird");
var request = Promise.promisifyAll(require("request"));
var cluster = require('cluster');
var http = require('http');
var fs = require('fs');
var path = require('path');

// Config
var NUM_CLIENT = 1;
var MAX_DELAY = 500;
//var NUM_REQUEST = Infinity;
var NUM_REQUEST = 100;
var PRINT_OUTPUT = false;
//var HOST = 'https://54.174.49.59';
var HOST = 'https://localhost:3000';
var caFile = path.resolve(__dirname, '../keys/bloomberg-ca-crt.pem');
var keyFile = path.resolve(__dirname, '../keys/client-key.pem');
var certFile = path.resolve(__dirname, '../keys/client-crt.pem');

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
    clientRequest(cluster.worker.id);
}


function clientRequest(clientId) {
    var counter = 0;
    var agent = new http.Agent();
    var opt = {
                cert: fs.readFileSync(certFile),
                key: fs.readFileSync(keyFile),
                ca: fs.readFileSync(caFile),
                rejectUnauthorized: false
              }
    console.log('Client Id: ' + clientId + '. Start testing.');

    // Subscribe
    request.postAsync({
        url : HOST + '/subscribe',
        body : [
                { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] },
                { security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
               ],
        pool: agent,
        json: true,
        agentOptions: opt
    })
    .then(function(contents) {
        console.log(contents[1]);
        if (contents[1].status === undefined) {
            process.exit();
        }
    })
    .then(function() {
        longPolling();
    })
    .catch(function(err) {
        console.log(err);
        process.exit()
    });

    function longPolling() {
        var delay = Math.floor((Math.random() * MAX_DELAY));
        var t = process.hrtime();
        request.getAsync({
            url : HOST + '/poll?pollid=' + counter,
            pool: agent,
            json: true,
            agentOptions: opt
        })
        .then(function(contents) {
            var diff = process.hrtime(t);
            console.log('Client Id: ' + clientId + '. Response: ' + counter + '. Time: ' + (diff[0] * 1e3 + diff[1] / 1e6) + 'ms');
            if (contents[0].statusCode === 200 && !contents[1].status) {
                ++counter;
            }
            if (PRINT_OUTPUT) {
                console.log(contents[1]);
            }
        })
        .delay(delay)
        .then(function(){
            if (counter < NUM_REQUEST) {
                longPolling();
            }
            else {
                request.postAsync({
                    url : HOST + '/unsubscribe',
                    //body : { correlationIds: [0] },
                    pool: agent,
                    json: true,
                    agentOptions: opt
                })
                .then(function(contents) {
                    console.log('Unsubscribed.');
                    if (PRINT_OUTPUT) {
                        console.log(contents[1]);
                    }
                    process.exit();
                });
            }
        })
        .catch(function(err) {
            console.log(err);
            process.exit();
        });

    };
};
