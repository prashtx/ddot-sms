/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var util = require('util');
var Q = require('q');
var api = require('./ddotapi.js');
var geocoder = require('./geocoder-nominatum.js');
var Strings = require('./strings.js');
var sman = require('./session-manager.js');


var keywords = {
  test: 'test',
  near: 'near',
  routes: 'routes'
};

function keywordMatches(keyword, str) {
  function check(kw) {
    var s = str.trimLeft();
    return (s.length >= keyword.length &&
            (s.substring(0, keyword.length).toLocaleLowerCase() ===
             keyword.toLocaleLowerCase()));
  }
  if (util.isArray(keyword)) {
    return keyword.some(check);
  }
  return check(keyword);
}

// fun(key, value)
function forEachKey(obj, fun) {
  var key;
  for (key in obj) {
    if (obj.hasOwnProperty(key)) {
      fun(key, obj[key]);
    }
  }
}

function startsWith(full, piece, options) {
  if (full.length < piece.length) { return false; }
  if (options && !options.caseSensitive) {
    // Case insensitive match
    return full.substring(0, piece.length).toLocaleLowerCase() ===
      piece.toLocaleLowerCase();
  }
  // Match case
  return full.substring(0, piece.length) === piece;
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


// Session tracking objects
//
// Types of stored conversation context
var conversationTypes = {
  // We asked a multiple choice question. We stored the valid responses,
  // actions to take, and action parameters
  multi: 'multichoice'
};

// Map stored strings to actual action that we should perform
var actions = {
  // Get the arrivals for the saved stop ID
  arrivalsForStop: function arrivalsForStop(stopId) {
    return Q.all([api.getStop(stopId), api.getArrivalsForStop(stopId)])
    .spread(function (stop, data) {
      var message = util.format(Strings.SingleStop, stop.name);
      message += ' ' + makeArrivalString(data.arrivals, data.now);
      return message;
    });
  }
};




function handleTestCommand(cmd) {
  var def = Q.defer();

  console.log('Handling a test command.');

  if (keywordMatches(keywords.near, cmd)) {
    // Get lon-lat for the specified location
    geocoder.code(cmd.substring(keywords.near.length), 'Detroit, MI')
    .then(function (coords) {
      // Get the nearby stops
      return api.getStopsForLocation(coords);
    })
    .then(function (stops) {
      var message = 'nearby stops: ';
      message += stops
      .map(function (stop) {
        return util.format('%s: %s', stop.id.substring('Detroit Department of Transportation_'.length), stop.name);
      })
      .join(' ');
      def.resolve(message);
    })
    .fail(function (reason) {
      def.reject();
    });
  } else if (keywordMatches(keywords.routes, cmd)) {
    console.log('Getting routes');
    api.getRoutes()
    .then(function (routes) {
      var message = 'Routes:';
      var i;
      for (i = 0; i < routes.length; i += 1) {
        message += ' ' + routes[i].shortName;
      }
      def.resolve(message);
    })
    .fail(function () { def.reject(); });
  } else {
    def.resolve('Did not understand the command');
  }

  return def.promise;
}

function tryContinueMultiConversation(sms, context) {
  // Get the index of the selected option
  var index = -1;
  var i;
  for (i = 0; i < context.choices.length; i += 1) {
    var choice = context.choices[i];
    if (startsWith(sms, choice, {caseSensitive: false}) &&
        (sms.length === choice.length || sms[choice.length] === ' ')) {
      index = i;
      break;
    }
  }

  // Do we have a valid response?
  if (index !== -1) {
    console.log('Continuing conversation with action: ' + context.actions[i]);
    // Perform the action. Returns a promise.
    return actions[context.actions[i]](context.params[i]);
  }
  return null;
}

module.exports = (function () {
  var self = {};

  self.respondToSms = function (sms, id) {
    // Look for the test keyword.
    if (keywordMatches(keywords.test, sms)) {
      return handleTestCommand(sms.substring(keywords.test.length));
    }

    return sman.get(id)
    .then(function (entry) {
      var promise;

      // See if the message is still part of the conversation.
      if (entry !== null) {
        var context = entry.context;
        // We only handle multiple choice right now.
        if (context.type === conversationTypes.multi) {
          promise = tryContinueMultiConversation(sms, context);
        }
      }

      // If we matched the SMS to a conversation, then we're done here.
      if (promise) {
        return promise;
      }

      // If we didn't match the SMS to a conversation, treat it as an initial
      // request.
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
        var def = Q.defer();
        api.getArrivalsForStop(stopId)
        .then(function (data) {
          def.resolve(makeArrivalString(data.arrivals, data.now));
        })
        .fail(function (reason) {
          def.resolve(Strings.GenericFailMessage);
        });
        promise = def.promise;
      } else {
        // Non-numeric. Treat it as a location.

        // Get lon-lat for the specified location
        promise = geocoder.code(sms, 'Detroit, MI')
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

            var context = {
              type: conversationTypes.multi,
              choices: [],
              actions: [],
              params: []
            }

            var letters = ['A', 'B', 'C'];
            var i;
            var options = [];
            for (i = 0; i < letters.length && i < stops.length - 1; i += 1) {
              options.push(util.format('%s) %s', letters[i], stops[i + 1].name));
              context.choices.push(letters[i]);
              context.actions.push('arrivalsForStop');
              context.params.push(stops[i + 1].id);
            }

            // Save the session context.
            sman.save(id, context);

            // TODO: Can we use a newline?
            message += options.join(' ');
            return message;
          });
        })
        .fail(function (reason) {
          throw reason;
        });
      }
      return promise;
    });
  };

  return self;
}());
