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
var nominatum = require('./geocoder-nominatum.js');
var google = require('./geocoder-google.js');
var cache = require('./geocoder-cache.js');

var minYahooQuality = 40;

module.exports = (function () {
  var self = {};

  self.comboCode = function (line1, line2) {
    var yahooPromise = yahoo.code(line1, line2);
    var nominatumPromise = nominatum.code(line1, line2);

    var yahooResult;
    var yahooReason;
    var nominatumResult;
    var nominatumReason;

    // TODO: If Yahoo Placefinder is successful and meets the quality bar, then
    // we don't have to wait for the Nominatum request.
    yahooPromise.then(function (value) {
      yahooResult = value;
    })
    .fail(function (reason) {
      console.log('Yahoo Placefinder failed: ' + reason.message);
      yahooReason = reason;
    });

    nominatumPromise.then(function (value) {
      nominatumResult = value;
    })
    .fail(function (reason) {
      console.log('Nominatum failed: ' + reason.message);
      nominatumReason = reason;
    });

    return Q.allResolved([yahooPromise, nominatumPromise])
    .then(function (promises) {
      if (nominatumReason && yahooReason) {
        throw new Error('All geocoder services failed to return results.');
      }

      if (nominatumReason) {
        // Nominatum failed, Yahoo succeeded, so Yahoo's quality value doesn't matter.
        console.log('Geocoder: using Yahoo Placefinder');
        return yahooPromise;
      }

      if (yahooReason) {
        // Yahoo failed, so go with Nominatum
        console.log('Geocoder: using Nominatim');
        return nominatumPromise;
      }

      // Both methods succeeded, so check Yahoo's quality
      if (yahooResult.meta.quality < minYahooQuality) {
        console.log('Geocoder: using Nominatim');
        return nominatumPromise;
      }

      console.log('Geocoder: using Yahoo Placefinder');
      return yahooPromise;
    })
    .then(function (coords) {
      cache.add(line1, line2, coords);
      console.log('Geocoder: using Yahoo+Nominatim');
      return coords;
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
    // TODO: normalize the input before caching (toLowercase, maybe compress whitespace)
    return cache.get(line1, line2).then(function (cachedCoords) {
      if (cachedCoords !== null) {
        console.log('Geocoder: using cache');
        return cachedCoords;
      }

      // Cache miss. Try Google Maps.
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
