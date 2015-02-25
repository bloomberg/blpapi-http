var fs = require('fs');
var util = require('util');
var request = require("request");

var host = process.argv[2] || 'http-api.openbloomberg.com';
var port = 3000;
var url = 'https://' + host + ':' + port;
var NUM_REQUEST = 10;   // Number of long-poll requests before unsubscribe
var counter = 0;
var opt = {
    cert: fs.readFileSync('client.crt'),
    key: fs.readFileSync('client.key'),
    ca: fs.readFileSync('bloomberg.crt')
};

function subscribe()
{
    request.post({
        url: url + '/subscription?action=start',
        body: [
                { security: 'AAPL US Equity', correlationId: 0, fields: ['LAST_PRICE'] },
                { security: 'GOOG US Equity', correlationId: 1, fields: ['LAST_PRICE'] }
              ],
        json: true,
        agentOptions: opt
    }, function (error, response, body) {
        if (error) {
            console.log(err.message);
            process.exit();
        }
        console.log('Subscribed.');
        console.log(body);
        poll();
    });
}

function poll()
{
    request.get({
        url: util.format('%s/subscription?pollid=%d', url, counter),
        json: true,
        agentOptions: opt
    }, function (error, response, body) {
        if (error) {
            console.log(err.message);
            process.exit();
        }
        console.log('Response: ' + counter);
        if (response.statusCode === 200 && !body.status) {
            ++counter;  // Increase poll id only if poll succeed
        }
        console.log(body);
        if (counter < NUM_REQUEST) {
            poll();
        } else {
            unsubscribe();
        }
    });
}

function unsubscribe()
{
    request.post({
        url: url + '/subscription?action=stop',
        json: true,
        agentOptions: opt
    }, function (error, response, body) {
        if (error) {
            console.log(err.message);
            process.exit();
        }
        console.log('Unsubscribed.');
        console.log(body);
        process.exit();
    });    
}

subscribe();