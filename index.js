var connect = require('connect');
var morgan = require('morgan');
var formBody = require('body/json');
var app = connect();
var blpapi = require('blpapi');


var hp = { serverHost: '127.0.0.1', serverPort: 8194 };
// Add 'authenticationOptions' key to session options if necessary.
var session = new blpapi.Session({ serverHost: hp.serverHost,
                                   serverPort: hp.serverPort });
var service_refdata = 1; // Unique identifier for refdata service

var seclist = ['AAPL US Equity', 'VOD LN Equity'];

session.on('SessionStarted', function(m) {
    console.log(m);
    session.openService('//blp/refdata', service_refdata);
});

session.on('ServiceOpened', function(m) {
    console.log(m);
    app.listen(3000);
    // Check to ensure the opened service is the refdata service
    if (m.correlations[0].value == service_refdata) {

    }
});

var hnd
session.on('HistoricalDataResponse', function(m) {
    console.log(m);
    if (hnd) {
      var t = hnd;
      hnd = null;
      t(m);
    }
//    // At this point, m.correlations[0].value will equal:
//    // 101 -> HistoricalDataResponse for both securities
//    //
//    // m.eventType == 'PARTIAL_RESPONSE' until finally
//    // m.eventType == 'RESPONSE' to indicate there is no more data
//    if (m.correlations[0].value === 101 && m.eventType === 'RESPONSE')
//        checkStop();
});

session.on('SessionTerminated', function(m) {
    session.destroy();
});

app.use(morgan('combined'))
app.use(function (req,res) { formBody(req, res, function (err, body) {

        // err probably means invalid HTTP protocol or some shiz.
        if (err) {
            res.statusCode = 500
            return res.end("NO U")
        }
        console.log(body);

        // Request intraday tick data for each security, 10:30 - 14:30
        session.request('//blp/refdata', 'HistoricalDataRequest',
            { securities: seclist,
              fields: ['PX_LAST', 'OPEN'],
              startDate: "20120101",
              endDate: "20120301",
              periodicitySelection: "DAILY" }, 101);         // I am an echo server
        hnd = function (m) {
	      res.setHeader("content-type", "application/json");
	      res.end(JSON.stringify(m));
        }
    })} );
//app.listen(3000);

session.start()
