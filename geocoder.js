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
    return yahoo.code(line1, line2)
    .then(function (coords) {
      // Check if the Yahoo Placefinder result meets the quality bar.
      if (coords.meta.quality >= minYahooQuality) {
        console.log('Geocoder: using Yahoo Placefinder');
        // Add to cache.
        cache.add(line1, line2, coords);
        return coords;
      }

      throw {
        name: 'BadLocationError',
        message: 'Yahoo gave us a low-quality location'
      };
    })
    .fail(function (reason) {
      console.log('Yahoo Placefinder failed: ' + reason.message);
      // Yahoo Placefinder failed, so use Nominatim.
      return nominatim.code(line1, line2)
      .then(function (coords) {
        console.log('Geocoder: using Nominatim');
        return coords;
      });
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
      if (reason.name === 'BadLocationError') {
        // If Google choked on this location, then we assume it is invalid.
        throw reason;
      }
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
    }, function (reason) {
      // Cache error.
      console.log('Error in cache.get:');
      console.log(reason.message);

      // Try Google Maps.
      return self.googleCode(line1, line2);
    });
  };

  return self;
}());
