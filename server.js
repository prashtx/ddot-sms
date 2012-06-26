/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var http = require('http');
var express = require('express');
var tropowebapi = require('tropo-webapi');
var request = require('request');
var util = require('util');

var Strings = require('./strings.js');
var smsflow = require('./sms-flow.js');
var geocoder = require('./geocoder.js'); // XXX
var api = require('./ddotapi.js'); // XXX

var app = express.createServer(express.logger());

app.configure(function() {
  app.use(express.bodyParser());
});


app.post('/', function (req, res) {
  var startTime = Date.now();
  var tropo = new tropowebapi.TropoWebAPI();
  res.setHeader('Content-Type', 'application/json');

  // TODO: scrub Personally Identifiable Information in production
  console.log('\nInbound message info:');
  console.log(req.body);

  var session = req.body.session;
  var initialText = session.initialText.trim();
  smsflow.respondToSms(initialText, session.from.id)
  .then(function (message) {
    tropo.say(message);
    var jsonOut = tropowebapi.TropoJSON(tropo);
    console.log('Outbound message info:');
    console.log(jsonOut);
    console.log('Message length: ' + message.length);
    console.log('Processing time: ' + (Date.now() - startTime));
    res.send(jsonOut);
  })
  .fail(function (reason) {
    console.log(reason);
    console.log(reason.stack);
    tropo.say(Strings.GenericFailMessage);
    var jsonOut = tropowebapi.TropoJSON(tropo);
    console.log('Outbound message info:');
    console.log(jsonOut);
    console.log('Processing time: ' + (Date.now() - startTime));
    res.send(jsonOut);
  });
});


app.post('/geocode', function(req, res) {
  geocoder.code(req.body.line1, req.body.line2)
  .then(function (coords) {
    res.send(JSON.stringify({
      status: 'success',
      lat: coords.lat,
      lon: coords.lon
    }), 200);
  }, function (reason) {
    res.send('{status: error}');
  });
});

app.post('/routes', function(req, res) {
  var tropo = new tropowebapi.TropoWebAPI();

  api.getRoutes().then(
  function (routes) {
    var message = 'Routes:';
    var i;
    for (i = 0; i < routes.length; i += 1) {
      message += ' ' + routes[i].shortName;
    }
    var pieces = [message];
    var newPiece;
    var lastIndex = pieces.length - 1;
    while (pieces[lastIndex].length > 140) {
      newPiece = pieces[lastIndex].substring(140);
      pieces[lastIndex] = pieces[lastIndex].substring(0, 140);
      pieces.push(newPiece);
    }
    for (i = 0; i < pieces.length; i += 1) {
      tropo.say(pieces[i]);
    }
    res.send(tropowebapi.TropoJSON(tropo));
  },
  function () {
    tropo.say('Oops! System error. Please try again in a bit.');
    res.send(tropowebapi.TropoJSON(tropo));
  });
});

/*
app.post('/one', function(req, res){
  // Create a new instance of the TropoWebAPI object.
  var tropo = new tropowebapi.TropoWebAPI();
  tropo.say("Hello from resource one!");
  tropo.on("continue", null, "/two", true);

  res.send(tropowebapi.TropoJSON(tropo));
});

app.post('/two', function(req, res){
  // Create a new instance of the TropoWebAPI object.
  var tropo = new tropowebapi.TropoWebAPI();
  tropo.say("Hello from resource two!");
  tropo.say("Well, enough of that. Goodbye.");

  res.send(tropowebapi.TropoJSON(tropo));
});
*/




var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
