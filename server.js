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
  var tropo = new tropowebapi.TropoWebAPI();

  var initialText = req.body.session.initialText.trim();
  smsflow.respondToSms(initialText)
  .then(function (message) {
    //tropo.say(message);
    //res.send(tropowebapi.TropoJSON(tropo));
    //res.send(encodeURIComponent('{"tropo":[{ "say":{"value":"each\r\non\r\nnew\r\nline"}}]}'));
    //res.send('{"tropo":[{ "say":{"value":"each on new line"}}]}');
    res.setHeader('Content-Type', 'application/json');
    //tropo.say('each\r\non\r\nnew\r\nline');
    //res.send(tropowebapi.TropoJSON(tropo));
    res.send(JSON.stringify({tropo: [{say: {value: 'each\r\non\r\nnew\r\nline'}}]}));
  })
  .fail(function (reason) {
    //tropo.say(Strings.GenericFailMessage);
    //res.send(tropowebapi.TropoJSON(tropo));
    res.setHeader('content-type', 'application/json');
    //res.send('{"tropo":[{"say":{"value":"each\r\non\r\nnew\r\nline"}}]}');
    tropo.say('each\r\non\r\nnew\r\nline');
    res.send(tropowebapi.TropoJSON(tropo));
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
