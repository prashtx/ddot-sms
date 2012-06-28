/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var util = require('util');
var Q = require('q');
var api = require('./ddotapi.js');
var geocoder = require('./geocoder.js');
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

// Determine if any of the arrival times are based on schedule data (as opposed
// to predicted, real-time data).
function hasSched(arrivals) {
  return arrivals.some(function (entry) {
    return !entry.predicted;
  });
}

function organizeArrivalsByHeadsign(arrivals, now, max) {
  var headsigns = {};
  arrivals.forEach(function (entry) {
    // Times for this headsign
    var times = headsigns[entry.headsign];
    if (times === undefined) {
      times = [];
      headsigns[entry.headsign] = times;
    }

    // Don't add more arrivals if we've reached the max.
    if (max && (times.length >= max)) {
      return;
    }

    // Milliseconds to minutes.
    var timeString = Math.floor((entry.arrival - now) / 60000).toString();
    if (!entry.predicted) {
      // Indicate schedule-only data.
      timeString += '*';
    }
    times.push(timeString);
  });

  return headsigns;
}

// Create a string of headsigns and arrival times.
// arrivals: the array of arrivals as returned by ddotapi
// now: the current time as reported by the API
// max (optional): the maximum number of arrivals to include
function makeArrivalString(arrivals, now, max) {
  if (arrivals.length === 0) {
    // If there are no arrivals at all, say so.
    return Strings.NoArrivals;
  }

  // Organize by headsign
  var headsigns = organizeArrivalsByHeadsign(arrivals, now, max);

  // Join the various headsigns, omitting the ones with no arrivals.
  var arrivalSets = [];
  forEachKey(headsigns, function (headsign, times) {
    // If there are no arrivals for this headsign, skip.
    if (times.length === 0) { return; }

    var timeString = times.join(', ');
    var arrivalString = util.format('%s: %s min', headsign, timeString);
    arrivalSets.push(arrivalString);
  });

  // TODO: can we use a newline?
  if (hasSched(arrivals)) {
    return util.format(Strings.MiscWithSched, arrivalSets.join(' '));
  }
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
      var formatString = Strings.SingleStop;
      if (hasSched(data.arrivals)) {
        formatString = Strings.SingleStopWithSched;
      }
      var message = util.format(formatString,
                                stop.name,
                                makeArrivalString(data.arrivals, data.now, 5));
      return message;
    });
  },

  // Get the arrivals for the saved stop ID and present the arrivals that match
  // the saved headsign.
  // info = JSON.stringify({stopId: 'someID', headsign: 'someHeadsign'})
  arrivalsForStopAndHeadsign: function arrivalsForStopAndHeadsign(infoJSON) {
    var info = JSON.parse(infoJSON);
    return Q.all([api.getStop(info.stopId), api.getArrivalsForStop(info.stopId)])
    .spread(function (stop, data) {
      var formatString = Strings.SingleStop;
      var arrivals = data.arrivals.filter(function (item) {
        return item.headsign === info.headsign;
      });

      if (hasSched(arrivals)) {
        formatString = Strings.SingleStopWithSched;
      }
      var message = util.format(formatString,
                                stop.name,
                                makeArrivalString(arrivals, data.now, 5));
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
      var number = parseInt(sms, 10);
      // TODO: distinguish between zipcodes and stop IDs
      if (!isNaN(number) && number.toString() === sms.trim()) {
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
          def.resolve(makeArrivalString(data.arrivals, data.now, 5));
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
          if (stops.length === 0) {
            throw new Error('No stops found. Probably the geocoder was way off.');
          }

          // Get arrivals for the nearest 5 stops.
          var arrivalPromises = [];
          var stopInd;
          for (stopInd = 0; stopInd < 5 && stopInd < stops.length; stopInd += 1) {
            arrivalPromises.push(api.getArrivalsForStop(stops[stopInd].id));
          }

          return arrivalPromises[0].then(function (data) {
            // Closest stop
            var message = util.format(Strings.ClosestStop, stops[0].name);
            message += ' ' + makeArrivalString(data.arrivals, data.now, 3);
            return message;
          }, function (reason) {
            // If we fail to get data on the nearest stop, we can't craft a
            // very nice response. For now, just fail.
            // TODO: We should be able to recover by providing arrivals from
            // the next-closest stop.
            throw reason;
          })
          .then(function (message) {
            return Q.allResolved(arrivalPromises)
            .then(function (promises) {
              var data;

              // seen keeps track of headsigns that we've encountered at stops
              // closer to our target location.
              var seen = {};

              // novel holds information on headsigns that we should report to
              // the user.
              var novel = {};

              // Process the first one separately. We shouldn't present those
              // headsigns as options, since we've already provided the arrival
              // times. But we don't want to duplicate the routes in the
              // options, either.
              if (promises[0].isFulfilled()) {
                data = promises[0].valueOf();
                data.arrivals.forEach(function (item) {
                  seen[item.tripHeadsign] = true;
                });
              } else {
                throw promises[0].valueOf().exception;
              }

              var stopInd = 0;
              promises.slice(1).forEach(function (promise) {
                stopInd += 1;
                // Skip the failed requests and move on
                if (!promise.isFulfilled()) {
                  return;
                }
                data = promise.valueOf();

                // Hang onto the info we need to later recall the arrivals for
                // this stop and filter by a particular headsign.
                var headsigns = {};
                data.arrivals.forEach(function (entry) {
                  // Info needed to recall this arrival.
                  var info = headsigns[entry.headsign];
                  if (info === undefined) {
                    info = {
                      stopId: stops[stopInd].id,
                      headsign: entry.headsign
                    };
                    headsigns[entry.headsign] = info;
                  }
                });

                // Keep the ones we haven't seen yet.
                var headsign;
                for (headsign in headsigns) {
                  if (headsigns.hasOwnProperty(headsign)) {
                    // If we haven't encountered this headsign at another stop,
                    // then let's add it.
                    if (!seen.hasOwnProperty(headsign)) {
                      novel[headsign] = headsigns[headsign];
                      // Make sure we don't process the same headsign at a later stop.
                      seen[headsign] = true;
                    }
                  }
                }
              });

              // From the "extra" headsigns, create pieces of the message to
              // present options the user, as well as context information, so
              // we can continue the conversation.

              // Other stops
              message += ' ' + Strings.OtherCloseRoutes + ' ';

              var context = {
                type: conversationTypes.multi,
                choices: [],
                actions: [],
                params: []
              };

              var headsignList = [];
              forEachKey(novel, function(headsign, info) {
                headsignList.push(info);
              });

              var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
              var i;
              var optionsText = [];
              for (i = 0; i < letters.length && i < headsignList.length - 1; i += 1) {
                optionsText.push(util.format(Strings.Option, letters[i], headsignList[i + 1].headsign));
                context.choices.push(letters[i]);
                context.actions.push('arrivalsForStopAndHeadsign');
                context.params.push(JSON.stringify(headsignList[i + 1]));
              }

              // Save the session context.
              sman.save(id, context);

              message += optionsText.join(' ');

              return message;
            });
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
