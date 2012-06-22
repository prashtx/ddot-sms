/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Multi-service geocoder.
 * Asynchronously calls Yahoo Placefinder and Nominatum. If Yahoo's quality
 * indication is poor, we use Nominatum, unless the latter didn't return any
 * results.
 */

var request = require('request');
var url = require('url');
var Q = require('q');

var yahoo = require('./geocoder-yahoo.js');
var nominatum = require('./geocoder-nominatum.js');

var minYahooQuality = 40;

module.exports = (function () {
  var self = {};

  self.code = function (line1, line2) {
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
        console.log('Using Yahoo Placefinder geocoder');
        return yahooPromise;
      }

      if (yahooReason) {
        // Yahoo failed, so go with Nominatum
        console.log('Using Nominatum geocoder');
        return nominatumPromise;
      }

      // Both methods succeeded, so check Yahoo's quality
      if (yahooResult.meta.quality < minYahooQuality) {
        console.log('Using Nominatum geocoder');
        return nominatumPromise;
      }

      console.log('Using Yahoo Placefinder geocoder');
      return yahooPromise;
    });
  };

  return self;
}());
