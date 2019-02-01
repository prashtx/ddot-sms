/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var http = require('http');
var express = require('express');
var request = require('request');
var util = require('util');
var http = require('http');
var crc = require('crc');

var Strings = require('./strings.js');
var smsflow = require('./sms-flow.js');
var twilio = require('./twilio.js');
var logger = require('./logger.js');

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

  var to = req.body.To || '';
  // Mask the user's phone number
  var from = '0';
  if (req.body.From !== undefined) {
    from = crc.hex32(crc.crc32(req.body.From));
  }

  // Record information for the log.
  var logEntry = logger.makeEntry(from);
  logEntry.data.message = initialText;

  console.log('\nInbound message info:');
  console.log(JSON.stringify({ from: from, to: to, body: initialText }));

  smsflow.respondToSms(initialText, from, logEntry)
  .then(function (message) {
    var twiML = twilio.sms(message);
    twilio.sendTwiML(res, twiML);

    logEntry.data.responseCount = twilio.countMessages(twiML);

    // Log the recorded data to the logger web service
    logEntry.send();

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

    logEntry.data.error = true;

    // Log the recorded data to the logger web service
    logEntry.send();

    console.log('Outbound message info:');
    console.log(twiML);
    console.log('Processing time: ' + (Date.now() - startTime));
  });
});


var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log('Listening on ' + port);
});
