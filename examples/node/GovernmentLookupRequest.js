// usage: node GovernmentLookupRequest.js [<host>]
var https = require('https');
var fs = require('fs');

var host = process.argv[2] || "http-api.openbloomberg.com";
var port = 443

var options = {
    host: host,
    port: port,
    path: '/request?ns=blp&service=instruments&type=govtListRequest',
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
    "query": "*",
    "partialMatch": true,
    "maxResults": 10
}));
req.end();

req.on('error', function(e) {
    console.error(e);
});
