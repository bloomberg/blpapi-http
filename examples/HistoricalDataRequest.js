var http = require('http');

// change HOST and PORT to where the blpapi-http web server is running
var HOST = '127.0.0.1';
var PORT = 3000;

var histDataReqPayload = {
    securities: ['AAPL US Equity', 'VOD LN Equity'],
    fields: ['PX_LAST', 'OPEN'],
    startDate: "20120101",
    endDate: "20120301",
    periodicitySelection: "DAILY"
};

var connectReqOpts = {
    host: HOST,
    port: PORT,
    method: 'POST',
    path: '/v1.0/connect'
};

var req = http.request(connectReqOpts, function(resp) {
    console.log('RESPONSE: /v1.0/connect');
    console.log('STATUS: ' + resp.statusCode);
    console.log('HEADERS: ' + JSON.stringify(resp.headers))

    var data = "";
    resp.on('data', function(chunk) {
        data += chunk;
    });

    resp.on('end', function() {
        data = JSON.parse(data);
        var sessionId = data.sessid;

        var histDataRequestOpts = {
            host: HOST,
            port: PORT,
            method: 'POST',
            path: '/v1.0/request/blp/refdata/HistoricalData?sessid=' + sessionId
        };
        console.log(histDataRequestOpts);

        req = http.request(histDataRequestOpts, function(resp) {
            console.log('RESPONSE: /v1.0/request/blp/refdata/HistoricalData');
            console.log('STATUS: ' + resp.statusCode);
            console.log('HEADERS: ' + JSON.stringify(resp.headers))

            data = "";
            resp.on('data', function(chunk) {
                data += chunk;
            });

            resp.on('end', function() {
                console.log(data);
            });

        });
        req.write(JSON.stringify(histDataReqPayload));
        req.end();
    });
});

req.on('error', function(e) {
    console.log('Request error: ' + e.message);
});

req.end();

