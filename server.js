/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var http = require('http');
var express = require('express');
var tropowebapi = require('tropo-webapi');
var request = require('request');

var api = require('./ddotapi.js');

var app = express.createServer(express.logger());

app.configure(function() {
  app.use(express.bodyParser());
});

app.post('/', function(req, res){
  // Create a new instance of the TropoWebAPI object.
  var tropo = new tropowebapi.TropoWebAPI();
  // Use the say method https://www.tropo.com/docs/webapi/say.htm
  tropo.say("Welcome to my Tropo Web API node demo.");
  // Use the on method https://www.tropo.com/docs/webapi/on.htm
  tropo.on("continue", null, "/one", true);

  res.send(tropowebapi.TropoJSON(tropo));
});

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




var port = process.env.PORT || 3000;
app.listen(port, function() {
  console.log('Listening on ' + port);
});
