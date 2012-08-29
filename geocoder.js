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

var yahoo = require('./geocoder-yahoo.js');
var nominatim = require('./geocoder-nominatum.js');
var google = require('./geocoder-google.js');
var cache = require('./geocoder-cache.js');
var metrics = require('./metrics.js');

var minYahooQuality = 40;

module.exports = (function () {
  var self = {};

  self.comboCode = function (line1, line2) {
    var yahooPromise = yahoo.code(line1, line2);
    var nominatimPromise = nominatim.code(line1, line2);

    console.log('Geocoder: using Yahoo+Nominatim');

    return yahooPromise.then(function (yahooResult) {
      // Check if the Yahoo Placefinder result meets the quality bar.
      if (yahooResult.meta.quality >= minYahooQuality) {
        console.log('Geocoder: using Yahoo Placefinder');
        return yahooResult;
      }

      // If we got a fuzzy response from Yahoo, then let's process the Nominatim response.
      return nominatimPromise.then(function (nominatimResult) {
        // Nominatim succeeded, and Yahoo was below the quality bar, so let's
        // use Nominatim.
        console.log('Geocoder: using Nominatim');
        return nominatimResult;
      })
      .fail(function (reason) {
        // Nominatim failed, so we'll use Yahoo regardless of the quality.
        console.log('Nominatum failed: ' + reason.message);
        console.log('Geocoder: using Yahoo Placefinder');
        return yahooResult;
      });
    })
    .fail(function (reason) {
      console.log('Yahoo Placefinder failed: ' + reason.message);
      // Yahoo Placefinder failed altogether, so we have no choice left but to
      // use Nominatim.
      console.log('Geocoder: using Nominatim');
      return nominatimPromise;
    })
    .then(function (coords) {
      // Add to cache.
      cache.add(line1, line2, coords);
      return coords;
    })
    .fail(function (reason) {
      // All geocoders failed!
      console.log(reason.message);
      console.log('All geocoders failed!');
      throw reason;
    });
  };

  self.googleCode = function (line1, line2) {
    return google.code(line1, line2).then(function (coords) {
      cache.add(line1, line2, coords);
      console.log('Geocoder: using Google Maps');
      return coords;
    })
    .fail(function (reason) {
      console.log(reason.message);
      // We've used Google too recently or something went wrong. Try the
      // Yahoo/Nominatum combo.
      return self.comboCode(line1, line2);
    });
  };

  self.code = function (line1, line2) {
    // Check the cache
    return cache.get(line1, line2).then(function (cachedCoords) {
      if (cachedCoords !== null) {
        console.log('Geocoder: using cache');
        return cachedCoords;
      }

      // Cache miss. Try Google Maps.
      metrics.cacheMiss();
      return self.googleCode(line1, line2);
    })
    .fail(function (reason) {
      // Cache error.
      console.log('Error in cache.get:');
      console.log(reason.message);

      // Try Google Maps.
      return self.googleCode(line1, line2);
    });
  };

  return self;
}());
