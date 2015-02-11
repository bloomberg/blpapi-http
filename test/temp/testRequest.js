var Promise = require("bluebird");
var request = Promise.promisifyAll(require("request"));
var cluster = require('cluster');
var http = require('http');
var fs = require('fs');
var path = require('path');

// Config
var NUM_CLIENT = 10;
var MAX_DELAY = 500;
var NUM_REQUEST = Infinity;
var PRINT_OUTPUT = false;
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

    makeRequest();

    function makeRequest() {
        var delay = Math.floor((Math.random() * MAX_DELAY));
        var t = process.hrtime();
        request.postAsync({
            url : HOST + '/request/blp/refdata/HistoricalData',
            body :  {
                        securities: ['IBM US Equity', 'AAPL US Equity'],
                        fields: ['PX_LAST', 'OPEN', 'EPS_ANNUALIZED'],
                        startDate: '20120101',
                        endDate: '20120301',
                        periodicitySelection: 'DAILY'
                    },
            pool: agent,
            json: true,
            agentOptions: opt
        })
        .then(function(contents) {
            var diff = process.hrtime(t);
            console.log('Client Id: ' + clientId + '. Response: ' + counter++ + '. Time: ' + (diff[0] * 1e3 + diff[1] / 1e6) + 'ms');
            if (PRINT_OUTPUT) {
                console.log(contents[1]);
            }
        })
        .delay(delay)
        .then(function(){
            if (counter < NUM_REQUEST) {
                makeRequest();
            }
        })
        .catch(function(err) {
            console.log(err);
            process.exit();
        });
    };

}
