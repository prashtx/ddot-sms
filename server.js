/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var http = require('http');
var express = require('express');
var tropowebapi = require('tropo-webapi');
var request = require('request');
var util = require('util');
var http = require('http');

var Strings = require('./strings.js');
var smsflow = require('./sms-flow.js');
var twilio = require('./twilio.js');

var app = express();
var server = http.createServer(app);

app.configure(function() {
  app.use(express.logger());
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.multipart());
});

app.post('/twilio', function (req, res) {
  var startTime = Date.now();
  var initialText;
  if (req.body === undefined) {
    res.send(400);
    return;
  }

  initialText = req.body.Body;
  if (initialText === undefined) {
    res.send(400);
    return;
  }

  var from = req.body.From || '0';

  // TODO: scrub Personally Identifiable Information in production
  console.log('\nInbound message info:');
  console.log(JSON.stringify(req.body));

  smsflow.respondToSms(initialText, from)
  .then(function (message) {
    var twiML = twilio.sms(message);
    twilio.sendTwiML(res, twiML);

    console.log('Outbound message info:');
    console.log(twiML);
    console.log('Message length: ' + message.length);
    console.log('Processing time: ' + (Date.now() - startTime));
  })
  .fail(function (reason) {
    console.log(reason);
    console.log(reason.stack);

    var twiML = twilio.sms(Strings.GenericFailMessage);
    twilio.sendTwiML(res, twiML);

    console.log('Outbound message info:');
    console.log(twiML);
    console.log('Processing time: ' + (Date.now() - startTime));
  });
});

app.post('/tropo', function (req, res) {
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

var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log('Listening on ' + port);
});
