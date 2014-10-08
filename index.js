"use strict";

var http = require('http');
//var url = require('url');
var connect = require('connect');
var morgan = require('morgan');
var jsonBody = require('body/json');
//var textBody = require('body');
//var parseurl = require('parseurl');

var blpapi = require('blpapi');

var hp = { serverHost: '127.0.0.1', serverPort: 8194 };

var app = connect();

var serviceRefdata = 0;

var session = {
  blpsess:null,
  services:{}
};

app.use(morgan('combined'));

app.use( '/connect', function (req, res, next) {
  session.blpsess = new blpapi.Session({ serverHost: hp.serverHost,
				     serverPort: hp.serverPort });


  session.blpsess.on('SessionStarted', function(m) {
    console.log(m);
    res.end("connected");
  });

  session.blpsess.start();
});

app.use( '/request/', function (req,res,next) {
  var t = req.url.split('/');
  var reqParts = [];
  for ( var i = 0; i < t.length; ++i )
    if (t[i])
      reqParts.push(t[i]);
  if (reqParts.length != 3) {
    next("invalid request format");
    return;
  }

  if (!session.blpsess) {
    var err = "Not connected";
    next(err);
    return;
  }

  var service = "//" + reqParts[0] + "/" + reqParts[1];
  var ref = serviceRefdata++;
  var check = function () {
      if (!(service in session.services)) {
          console.log("Opening service", reqParts[0], reqParts[1]);
          session.blpsess.openService(service, ref);
          session.blpsess.once('ServiceOpened', function (m) {
              console.log(m);
              if (m.correlations[0].value == ref) {
                  session.services[service] = "open";
                  opened();
              }
          });
      }
      else {
          console.log("Using cached service", reqParts[0], reqParts[1]);
          opened();
      }
  };

  var opened = function () {
    jsonBody( req, res, function (err, body) {
      if (err) {
        console.log("ERRROR!", err );
        next(err);
        return;
      }

      console.log(JSON.stringify(body));

      var ref = serviceRefdata++;

      session.blpsess.request(service, reqParts[2]+ "Request", body, ref );
      session.blpsess.once(reqParts[2] + "Response", function(m) {
	    res.setHeader("content-type", "application/json");
	    res.end(JSON.stringify(m));
      })
    });
  };

  check();

});


http.createServer(app).listen(3000);
