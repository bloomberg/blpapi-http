// usage: node HistoricalDataRequest.js [<host>]
var https = require('https');
var fs = require('fs');

var host = process.argv[2] || "http-api.openbloomberg.com";
var port = 443

var options = {
    host: host,
    port: port,
    path: '/request?ns=blp&service=refdata&type=HistoricalDataRequest',
    method: 'POST',
    key: fs.readFileSync('client.key'),
    cert: fs.readFileSync('client.crt'),
    ca: fs.readFileSync('bloomberg.crt')
};

var req = https.request(options, function(res) {
    console.log("statusCode: ", res.statusCode);
    console.log("headers: ", res.headers);

    res.on('data', function(d) {
      process.stdout.write(d);
    });
});

req.write(JSON.stringify( {
    "securities": ["IBM US Equity", "AAPL US Equity"],
    "fields": ["PX_LAST", "OPEN", "EPS_ANNUALIZED"],
    "startDate": "20120101",
    "endDate": "20120301",
    "periodicitySelection": "DAILY"
}));
req.end();

req.on('error', function(e) {
    console.error(e);
});
