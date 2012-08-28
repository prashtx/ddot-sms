/*jslint node: true, indent: 2, white: true, vars: true */
'use strict';

var util = require('util');
var Q = require('q');
var api = require('./ddotapi.js');
var geocoder = require('./geocoder.js');
var Strings = require('./strings.js');
var sman = require('./session-manager.js');
var metrics = require('./metrics.js');


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

// For each word, make the first letter uppercase and the other letters
// lowercase.
function toMixedCase(str) {
  var arr = str.split(' ');
  return arr.map(function (s) {
    if (s.length <= 1) {
      return s.toLocaleUpperCase();
    }
    return s[0].toLocaleUpperCase() + s.substr(1).toLocaleLowerCase();
  }).join(' ');
}

// Compress whitespace in a string and trim the ends.
function compressWhitespace(str) {
  return str.trim().replace(/[\s\n\r]+/g,' ');
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

// Strip the trailing signature from an incoming SMS.
function stripSignature(msg) {
  // We check to see if the message has a coda that's been bracketed by one of
  // the following srings. The order here matters. If the signature is
  // '$$blahblah$$', and we're looking for signatures bracketed by '$', then
  // we'll just strip the last two '$' characters. So we need to search for
  // '$$'. In other words, we should put the greedier strings first.
  var signatureBrackets = [
    '$$',
    '**',
    '$',
    '*',
    '^.^',
    '^^',
    '^'
  ];

  function trimBracketed(msg, bracket) {
    // Look for bracketing by a string
    // So something like: real message *16 KINGS*
    // or: real message $$cool signature$$
    if (msg.length > bracket.length) {
      if(msg.slice(msg.length - bracket.length) === bracket) {
        var piece = msg.slice(0, -bracket.length);
        var index = piece.lastIndexOf(bracket);
        if (index !== -1) {
          return piece.slice(0, index);
        }
      }
    }
    return msg;
  }

  // We check to see if the message has a coda that's been bracketed by one of
  // the following strings. We try to find bracketed signatures first, because
  // we might need to be a little more conservative about separators.
  var signatureSeparators = [
    '\n',
    '^.^'
  ];

  function trimSeparated(msg, separator) {
    var index = msg.lastIndexOf(separator);
    if (index !== -1) {
      return msg.slice(0, index);
    }
    return msg;
  }

  var index;

  // Look for signatures bracketed by certain characters.
  var trimmed = signatureBrackets.reduce(function (prev, current) {
    // If we already trimmed successfully, skip the rest.
    if (prev !== msg) { return prev; }
    return trimBracketed(msg, current);
  }, msg);

  if (trimmed !== msg) {
    return trimmed;
  }

  trimmed = signatureSeparators.reduce(function (prev, current) {
    if (prev !== msg) { return prev; }
    return trimSeparated(msg, current);
  }, msg);

  if (trimmed !== msg) {
    return trimmed;
  }

  return msg;
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
  var scheduled = false;
  arrivals.forEach(function (entry) {
    // Skip entries in the past
    if (entry.arrival < now) {
      return;
    }

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
    var time = Math.floor((entry.arrival - now) / 60000);
    var timeString;
    if (entry.predicted) {
      timeString = util.format(Strings.TimeMinutes, time);
    } else {
      // Indicate schedule-only data.
      timeString = util.format(Strings.TimeMinutesSchedule, time);
      scheduled = true;
    }
    times.push(timeString);
  });

  return {
    headsigns: headsigns,
    scheduled: scheduled
  };
}

// Create a string of headsigns and arrival times.
// arrivals: the array of arrivals as returned by ddotapi
// now: the current time as reported by the API
// max (optional): the maximum number of arrivals to include
// stopName: the name of the stop in question
function makeArrivalString(arrivals, now, max, stopName) {
  // Filter out predictions for past arrivals, which might see if a bus is
  // ahead of schedule.
  arrivals = arrivals.filter(function (entry) {
    return entry.arrival > now;
  });

  // Make the stop name legible.
  if (stopName === undefined) {
    stopName = max;
  }
  stopName = toMixedCase(stopName);

  if (arrivals.length === 0) {
    // If there are no arrivals at all, say so.
    return util.format(Strings.NoArrivals, api.lookaheadTime, stopName);
  }

  // Organize by headsign
  var organized = organizeArrivalsByHeadsign(arrivals, now, max);
  var headsigns = organized.headsigns;

  // Join the various headsigns, omitting the ones with no arrivals.
  var arrivalSets = [];
  forEachKey(headsigns, function (headsign, times) {
    // If there are no arrivals for this headsign, skip.
    if (times.length === 0) { return; }

    var timeString = times.join(', ');
    var arrivalString = util.format(Strings.Arrivals, compressWhitespace(toMixedCase(headsign)), timeString);
    arrivalSets.push(arrivalString);
  });

  if (organized.scheduled) {
    return util.format(Strings.MiscWithSched, arrivalSets.join('\n'));
  }
  return arrivalSets.join('\n');
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
    return api.getArrivalsForStop(stopId)
    .then(function (data) {
      var formatString = Strings.SingleStop;
      if (hasSched(data.arrivals)) {
        formatString = Strings.SingleStopWithSched;
      }
      var message = util.format(formatString,
                                toMixedCase(data.stopName),
                                makeArrivalString(data.arrivals, data.now, 3, data.stopName));
      return message;
    });
  },

  // Get the arrivals for the saved stop ID and present the arrivals that match
  // the saved headsign.
  // info = JSON.stringify({stopId: 'someID', headsign: 'someHeadsign'})
  arrivalsForStopAndHeadsign: function arrivalsForStopAndHeadsign(infoJSON) {
    var info = JSON.parse(infoJSON);
    return api.getArrivalsForStop(info.stopId)
    .then(function (data) {
      var formatString = Strings.SingleStop;
      var arrivals = data.arrivals.filter(function (item) {
        return compressWhitespace(item.headsign) === info.headsign;
      });

      var message = util.format(formatString,
                                toMixedCase(data.stopName),
                                makeArrivalString(arrivals, data.now, 3, data.stopName));
      return message;
    });
  }
};




function handleTestCommand(cmd) {
  console.log('Handling a test command.');

  if (keywordMatches(keywords.near, cmd)) {
    // Get lon-lat for the specified location
    return geocoder.code(cmd.substring(keywords.near.length), 'Detroit, MI')
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
      .join('\n');
      return message;
    });
  }

  if (keywordMatches(keywords.routes, cmd)) {
    console.log('Getting routes');
    return api.getRoutes()
    .then(function (routes) {
      var message = 'Routes:';
      var i;
      for (i = 0; i < routes.length; i += 1) {
        message += ' ' + routes[i].shortName;
      }
      return message;
    });
  }

  return Q.fcall(function () {
    return 'I did not understand the test command';
  });
}

function tryContinueMultiConversation(sms, context) {
  // Get the index of the selected option
  var index = -1;
  var i;
  for (i = 0; i < context.choices.length; i += 1) {
    var choice = context.choices[i];
    if (startsWith(sms, choice, {caseSensitive: false}) &&
        (sms.length === choice.length ||
         sms[choice.length] === ' ' ||
         sms[choice.length] === ')')) {
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

    // Track that we got a message
    metrics.message(id);

    sms = stripSignature(sms);
    console.log('Incoming message stripped of signature: ' + sms);

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
        // Track that the user is continuing a conversation
        metrics.conversationContinue(id);
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
        var stopPromise = api.getArrivalsForStop(stopId)
        .then(function (data) {
          return makeArrivalString(data.arrivals, data.now, 3, data.stopName);
        })
        .fail(function (reason) {
          console.log(reason.message);
          return Strings.GenericFailMessage;
        });

        // Track that the user sent a stop ID
        metrics.stopID(id);

        return stopPromise;
      }

      // Non-numeric. Treat it as a location.

      // Get lon-lat for the specified location
      return geocoder.code(sms, 'Detroit, MI')
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
          arrivalPromises.push(api.getHeadsignsForStop(stops[stopInd].id));
        }

        return Q.allResolved(arrivalPromises)
        .then(function (promises) {
          var stopsAndHeadsigns = [];
          var headsignHash = {};
          var rejectCount = 0;
          promises.forEach(function (promise) {
            if (promise.isFulfilled()) {
              var stop = promise.valueOf();
              var i;
              var headsign;
              for (i = 0; i < stop.headsigns.length; i += 1) {
                // Add unseen headsigns to the list.
                headsign = compressWhitespace(stop.headsigns[i]);
                if (!headsignHash.hasOwnProperty(headsign)) {
                  headsignHash[headsign] = true;
                  stopsAndHeadsigns.push({
                    stopId: stop.stopId,
                    headsign: headsign
                  });
                }
              }
            } else {
              rejectCount += 1;
            }
          });

          if (rejectCount === promises.length) {
            // All of the promises were rejected.
            throw new Error('Unable to get trip headsigns for nearby stops.');
          }

          if (stopsAndHeadsigns.length === 0) {
            // We didn't find any trips at nearby stops. Probably the buses
            // have stopped running around there.
            return Strings.NoCloseRoutes;
          }

          // If there's only one headsign, just report arrivals, don't bother with a conversation.
          if (stopsAndHeadsigns.length === 1) {
            return api.getArrivalsForStop(stopsAndHeadsigns[0].stopId)
            .then(function (data) {
              var arrivals = data.arrivals.filter(function (item) {
                return compressWhitespace(item.headsign) === stopsAndHeadsigns[0].headsign;
              });

              var message = util.format(Strings.SingleStop,
                                        toMixedCase(data.stopName),
                                        makeArrivalString(arrivals, data.now, 3, data.stopName));
              return message;
            });
          }

          // Multiple headsigns, so let's sort them before we present them.
          stopsAndHeadsigns.sort(function (a, b) {
            var aNum = parseInt(a.headsign.split(' ')[0], 10);
            var bNum = parseInt(b.headsign.split(' ')[0], 10);
            if (aNum < bNum || isNaN(bNum)) { return -1; }
            if (aNum > bNum || isNaN(aNum)) { return 1; }
            return 0;
          });

          // We need context, so we can continue the conversation later.
          var context = {
            type: conversationTypes.multi,
            choices: [],
            actions: [],
            params: []
          };

          var letters = ['A', 'B', 'C', 'D', 'E', 'F'];
          var optionsText = [];
          var i = 0;
          while (i < letters.length && i < stopsAndHeadsigns.length) {
            optionsText.push(util.format(Strings.Option, letters[i], toMixedCase(stopsAndHeadsigns[i].headsign)));
            context.choices.push(letters[i]);
            context.actions.push('arrivalsForStopAndHeadsign');
            context.params.push(JSON.stringify(stopsAndHeadsigns[i]));
            i += 1;
          }

          // Save the session context.
          sman.save(id, context);

          var message = Strings.CloseRoutes + '\n' + optionsText.join('\n');
          return message;
        });
      });
    });
  };

  return self;
}());
