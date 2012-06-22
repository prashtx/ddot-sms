/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Geocode functionality using the OpenStreetMap Nominatum geocoder
 */

var request = require('request');
var url = require('url');
var util = require('util');
var Q = require('q');

// Sample Nominatum request:
// http://nominatim.openstreetmap.org/search?q=michigan and woodward, detroit, mi, usa&format=json
var apiUrl = 'http://nominatim.openstreetmap.org/search';
var format = 'json';

var headers = {
  'User-Agent': 'ddot-sms/1.0 (detroit@codeforamerica.org)'
};

module.exports = (function () {
  var self = {};

  self.code = function (line1, line2) {
    var urlObj = url.parse(apiUrl);
    urlObj.query = {
      format: format,
      q: util.format('%s, %s, USA', line1, line2)
    };

    var def = Q.defer();
    var options = {url: url.format(urlObj), headers: headers};
    request.get(options, function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status: ' + resp.statusCode));
        return def.promise;
      }

      var data = JSON.parse(body);
      if (data.length > 0) {
        var coords = {
          lat: data[0].lat,
          lon: data[0].lon
        };
        def.resolve(coords);
      } else {
        def.reject(new Error('Geocoder returned no results'));
      }
    });

    return def.promise;
  };

  return self;
}());
