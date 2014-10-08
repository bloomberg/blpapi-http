"use strict";

var http = require('http');
var url = require('url');
var connect = require('connect');
var morgan = require('morgan');
var jsonBody = require('body/json');
var textBody = require('body');
var parseurl = require('parseurl');

var blpapi = require('blpapi');

var hp = { serverHost: '127.0.0.1', serverPort: 8194 };

var app = connect();

var serviceRefdata = 0;

var state = { session:null }

app.use(morgan('combined'))

app.use( '/connect', function (req, res, next) {
  state.session = new blpapi.Session({ serverHost: hp.serverHost,
				     serverPort: hp.serverPort });

  var ref = serviceRefdata++;

  state.session.on('SessionStarted', function(m) {
    console.log(m);
    state.session.openService('//blp/refdata', ref);
  });

  state.session.on('ServiceOpened', function(m) {
    console.log(m);
    // Check to ensure the opened service is the refdata service
    if (m.correlations[0].value == ref) {
      res.end("connected");
    }
  });

  state.session.start();
});

/*if (!String.prototype.endsWith) {
  Object.defineProperty(String.prototype, 'endsWith', {
    value: function (searchString, position) {
      var subjectString = this.toString();
      if (position === undefined || position > subjectString.length) {
        position = subjectString.length;
      }
      position -= searchString.length;
      var lastIndex = subjectString.indexOf(searchString, position);
      return lastIndex !== -1 && lastIndex === position;
    }
  });
} */

function endsWith ( a, b )
{
  var la = a.length;
  var lb = b.length;
  if (lb > la)
    return false;
  return a.substring(la-lb) === b;
}

app.use( '/request/', function (req,res,next) {
  var reqName = req.url.substring(1);
  if (!endsWith(reqName, "Request")) {
    next("Invalid request name");
    return;
  }
  reqName = reqName.substring(0,reqName.length - 7);

  if (!state.session) {
    var err = "Not connected";
    next(err);
    return;
  }

  jsonBody( req, res, function (err, body) {
    if (err) {
      console.log("ERRROR!", err );
      next(err);
      return;
    }

    console.log(JSON.stringify(body));

    var ref = serviceRefdata++;

    state.session.request('//blp/refdata', reqName + "Request", body, ref );
    state.session.once(reqName + "Response", function(m) {
	  res.setHeader("content-type", "application/json");
	  res.end(JSON.stringify(m));
    })
  });
});


http.createServer(app).listen(3000);
