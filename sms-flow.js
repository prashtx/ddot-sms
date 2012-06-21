/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var util = require('util');
var Q = require('q');
var api = require('./ddotapi.js');
var geocoder = require('./geocoder.js');
var Strings = require('./strings.js');


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
        s += ' (sched)';
      }
      return s;
    })
    .join(', ');
    var arrivalString = util.format('%s: %s min.', headsign, timeString);
    arrivalSets.push(arrivalString);
  });

  // TODO: can we use a newline?
  return arrivalSets.join(' ');
}

module.exports = (function () {
  var self = {};

  self.respondToSms = function (sms) {
    var def = Q.defer();

    if (!isNaN(parseInt(sms, 10))) {
      // We got numeric text. Treat it as a stop ID.
      var index = sms.indexOf(' ');
      var stopId;
      if (index === -1) {
        stopId = sms;
      } else {
        stopId = sms.substring(0, index);
      }

      // Fetch the arrival time info
      api.getArrivalsForStop(stopId)
      .then(function (data) {
        def.resolve(makeArrivalString(data.arrivals, data.now));
      })
      .fail(function (reason) {
        def.resolve(Strings.GenericFailMessage);
      });
    } else {
      // Non-numeric. Treat it as a location.

      // Get lon-lat for the specified location
      geocoder.code(sms, 'Detroit, MI')
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
          // TODO: can we use a newline?
          message += ' ' + makeArrivalString(data.arrivals, data.now);

          // Other stops
          // TODO: can we use a newline?
          message += ' ' + Strings.OtherCloseStops + ' ';

          var letters = ['A', 'B', 'C'];
          var i;
          var options = [];
          for (i = 0; i < letters.length && i < stops.length - 1; i += 1) {
            options.push(util.format('%s) %s', letters[i], stops[i + 1].name));
          }
          // TODO: Can we use a newline?
          //message += options.join(' ');
          message += options.join('\r\n');
          console.log('Message length: ' + message.length);
          def.resolve(message);
        });
      })
      .fail(function (reason) {
        def.reject();
      });
    }

    return def.promise;

  };

  return self;
}());
