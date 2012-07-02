/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Geocode functionality using the Google Maps geocoder
 */

var request = require('request');
var url = require('url');
var Q = require('q');

var apiUrl = 'http://maps.googleapis.com/maps/api/geocode/json';

module.exports = (function () {
  var self = {};

  self.code = function (line1, line2) {
    var urlObj = url.parse(apiUrl);
    // TODO: use viewport biasing with the bounds parameter
    urlObj.query = {
      sensor: false,
      address: line1 + ', ' + line2
    };

    var def = Q.defer();
    request.get(url.format(urlObj), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status: ' + resp.statusCode));
        return;
      }

      try {
        var data = JSON.parse(body);
        var location = data.results[0].geometry.location;
        var coords = {
          lat: location.lat,
          lon: location.lng
        };
        def.resolve(coords);
      } catch (e) {
        console.log('Caught exception getting data from Google Maps:');
        console.log(e.message);
        console.log('Google response body:');
        console.log(body);
        def.reject(e);
      }
    });

    return def.promise;
  };

  return self;
}());
