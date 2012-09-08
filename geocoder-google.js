/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Geocode functionality using the Google Maps geocoder
 */

var request = require('request');
var url = require('url');
var Q = require('q');

var apiUrl = 'http://maps.googleapis.com/maps/api/geocode/json';
var minPause = 1000;

module.exports = (function () {
  var self = {};

  var lastQueryTime = 0;

  self.code = function (line1, line2) {
    var urlObj = url.parse(apiUrl);
    // TODO: use viewport biasing with the bounds parameter
    urlObj.query = {
      sensor: false,
      address: line1 + ', ' + line2
    };

    var def = Q.defer();

    // See if we've queried the API too recently
    if (Date.now() - lastQueryTime < minPause) {
      def.reject({
        name: 'RateLimitError',
        message: 'Exceeded proactive rate check'
      });
      return def.promise;
    }

    // Update lastQueryTime before any asynchronous calls
    lastQueryTime = Date.now();

    request.get(url.format(urlObj), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status: ' + resp.statusCode));
        return;
      }

      try {
        var data = JSON.parse(body);
        if (data.status === 'OK') {
          var location = data.results[0].geometry.location;
          // See if Google has returned it's default Detroit location, which
          // most likely indicates that it did not understand the
          // address/intersection.
          if (location.lat === 42.331427 && location.lng === -83.0457538) {
            def.reject({
              name: 'BadLocationError',
              message: 'Google gave us the default location'
            });
          } else {
            var coords = {
              lat: location.lat,
              lon: location.lng,
              meta: {
                service: 'Google'
              }
            };
            def.resolve(coords);
          }
        } else if (data.status === 'OVER_QUERY_LIMIT') {
          // We've been rate-limited by Google
          def.reject({
            name: 'RateLimitError',
            message: 'Exceeded Google rate limit'
          });
        } else {
          def.reject(data.status);
        }
      } catch (e) {
        console.log('Caught exception getting data from Google Maps:');
        console.log(e.message);
        console.log('Google response body:');
        console.log(body);
        def.reject(e);
      }

      // Update lastQueryTime again, to be conservative, now that the query has
      // finished.
      lastQueryTime = Date.now();
    });

    return def.promise;
  };

  return self;
}());
