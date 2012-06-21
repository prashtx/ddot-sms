/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var http = require('http');
var express = require('express');
var tropowebapi = require('tropo-webapi');
var request = require('request');
var util = require('util');

var api = require('./ddotapi.js');
var geocoder = require('./geocoder.js');
var Strings = require('./strings.js');

var app = express.createServer(express.logger());

app.configure(function() {
  app.use(express.bodyParser());
});


// fun(key, value)
function forEachKey(obj, fun) {
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      fun(key, obj[key]);
    }
  }
}

function makeArrivalString(arrivals, now) {
  if (arrivals.length === 0) {
    // If there are no arrivals at all, say so.
    return Strings.NoArrivals;
  }

  // Organize by headsign, so we can format it for presentation.
  var headsigns = {};
  arrivals.forEach(function (entry) {
    // Times for this headsign
    var times = headsigns[entry.headsign];
    if (times === undefined) {
      times = [];
      headsigns[entry.headsign] = times;
    }

    times.push({predicted: entry.predicted, arrival: entry.arrival - now});
  });

  // Create the output text.
  var arrivalSets = [];
  forEachKey(headsigns, function (headsign, times) {
    // If there are no arrivals for this headsign, skip.
    if (times.length === 0) { return; }

    var timeString = times.map(function (entry) {
      // Milliseconds to minutes.
      var s = Math.floor(entry.arrival / 60000).toString();
      if (!entry.predicted) {
        s += ' (scheduled)';
      }
      return s;
    })
    .join(', ');
    var arrivalString = util.format('%s: %s minutes', headsign, timeString);
    arrivalSets.push(arrivalString);
  });

  return arrivalSets.join('\n');
}

app.post('/', function(req, res){
  // Create a new instance of the TropoWebAPI object.
  var tropo = new tropowebapi.TropoWebAPI();

  var initialText = req.body.session.initialText.trim();

  if (!isNaN(parseInt(initialText, 10))) {
    // We got numeric text. Treat it as a stop ID.
    var index = initialText.indexOf(' ');
    var stopId;
    if (index === -1) {
      stopId = initialText;
    } else {
      stopId = initialText.substring(0, index);
    }

    // Fetch the arrival time info
    api.getArrivalsForStop(stopId)
    .then(function (data) {
      tropo.say(makeArrivalString(data.arrivals, data.now));
      res.send(tropowebapi.TropoJSON(tropo));
    })
    .fail(function (reason) {
      tropo.say(Strings.GenericFailMessage);
      res.send(tropowebapi.TropoJSON(tropo));
    });
  } else {
    // Non-numeric. Treat it as a location.

    // Get lon-lat for the specified location
    geocoder.code(initialText, 'Detroit, MI')
    .then(function (coords) {
      // Get the nearby stops
      return api.getStopsForLocation(coords);
    })
    .then(function (stops) {
      // TODO: handle the case of no stops found.

      // Get arrivals for the nearest stop
      return api.getArrivalsForStop(stops[0].id)
      .then(function (data) {
        // Closest stop
        var message = util.format(Strings.ClosestStop, stops[0].name);
        message += '\n' + makeArrivalString(data.arrivals, data.now);

        // Other stops
        message += '\r\n' + Strings.OtherCloseStops + '\r\n';

        var letters = ['A', 'B', 'C'];
        var i;
        var options = [];
        for (i = 1; i < letters.length && i < stops.length; i += 1) {
          options.push(util.format('%s) %s', letters[i], stops[i].name));
        }
        message += options.join('\r\n');
        console.log('Message length: ' + message.length);
        tropo.say(message);
        res.send(tropowebapi.TropoJSON(tropo));
      });
    })
    .fail(function (reason) {
      tropo.say(Strings.GenericFailMessage);
      res.send(tropowebapi.TropoJSON(tropo));
    });
  }

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
