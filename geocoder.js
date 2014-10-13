/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Multi-service geocoder.
 * Uses a cache to store geocoder results. For cache misses, tries the Google
 * Maps API. If we've reached the Google Maps rate limit, then tries Yahoo
 * Placefinder and Nominatum. If Yahoo's quality indication is poor, we use
 * Nominatum, unless the latter didn't return any results.
 */

var request = require('request');
var url = require('url');
var Q = require('q');

var yahoo = require('./geocoder-yboss.js');
var nominatim = require('./geocoder-nominatum.js');
var google = require('./geocoder-google.js');
var cache = require('./geocoder-cache.js');
var metrics = require('./metrics.js');

var minYahooQuality = 40;
var detroit = 'Detroit, MI';
var dearborn = 'Dearborn, MI';
var highlandpark = 'Highland Park, MI';
var hamtramck = 'Hamtramck, MI';
var harperwoods = 'Harper Woods, MI';

module.exports = (function () {
  var self = {};

  self.comboCode = function (line1) {
    return yahoo.code(line1, detroit)
    .then(function (coords) {
      // Check if the Yahoo Placefinder result meets the quality bar.
      if (coords.meta.quality >= minYahooQuality) {
        console.log('Geocoder: using Yahoo Placefinder');
        metrics.geocoder('Yahoo');
        // Add to cache.
        cache.add(line1, detroit, coords);
        return coords;
      }

      var promises = [dearborn, highlandpark, hamtramck, harperwoods].map(function (city) {
        return yahoo.code(line1, city);
      });

      return Q.allResolved(promises)
      .then(function (promises) {
        var bestCoords;
        promises.forEach(function (promise) {
          if (promise.isFulfilled()) {
            var coords = promise.valueOf();
            if (bestCoords === undefined || coords.meta.quality > bestCoords.meta.quality) {
              bestCoords = coords;
            }
          }
        });
        if (bestCoords === undefined) {
          throw new Error('No results from Yahoo for other cities');
        } else {
          if (bestCoords.meta.quality >= minYahooQuality) {
            console.log('Geocoder: using Yahoo Placefinder for ' + bestCoords.meta.line2);
            // Add to cache with detroit, since that's how we'll look it up
            // later.
            cache.add(line1, detroit, bestCoords);
            return bestCoords;
          }

          throw {
            name: 'BadLocationError',
            message: 'Yahoo gave us a low-quality location'
          };
        }
      });
    })
    .fail(function (reason) {
      console.log('Yahoo Placefinder failed: ' + reason.message);
      // Yahoo Placefinder failed, so use Nominatim.
      return nominatim.code(line1, detroit)
      .then(function (coords) {
        console.log('Geocoder: using Nominatim');
        metrics.geocoder('Nominatim');
        return coords;
      })
      .fail(function (reason) {
        // All geocoders failed!
        console.log(reason.message);
        console.log('All geocoders failed!');
        metrics.geocoder('None');
        throw reason;
      });
    });
  };

  self.googleCode = function (line1) {
    return google.code(line1, detroit).then(function (coords) {
      cache.add(line1, detroit, coords);
      console.log('Geocoder: using Google Maps');
      metrics.geocoder('Google');
      return coords;
    })
    .fail(function (reason) {
      console.log(reason.message);
      if (reason.name === 'BadLocationError') {
        // If Google choked on this location, then try outside Detroit-proper.
        return google.code(line1, dearborn)
        .then(function (coords) {
          // Add to cache with detroit, since that's how we'll look it up next
          // time.
          cache.add(line1, detroit, coords);
          console.log('Geocoder: using Google Maps Dearborn');
          metrics.geocoder('Google Dearborn');
          return coords;
        })
        .fail(function (reason) {
          console.log(reason.message);
          // If we still get a bad location, then give up.
          if (reason.name === 'BadLocationError') {
            throw reason;
          }
          // We've used Google too recently or something went wrong. Try the
          // Yahoo/Nominatum combo.
          return self.comboCode(line1);
        });
      }
      // We've used Google too recently or something went wrong. Try the
      // Yahoo/Nominatum combo.
      return self.comboCode(line1);
    });
  };

  self.code = function (line1) {
    // Check the cache
    return cache.get(line1, detroit).then(function (cachedCoords) {
      if (cachedCoords !== null) {
        console.log('Geocoder: using cache');
        metrics.geocoder('Cache');
        return cachedCoords;
      }

      // Cache miss. Try Google Maps.
      metrics.cacheMiss();
      return self.googleCode(line1);
    }, function (reason) {
      // Cache error.
      console.log('Error in cache.get:');
      console.log(reason.message);

      // Try Google Maps.
      return self.googleCode(line1);
    });
  };

  return self;
}());
