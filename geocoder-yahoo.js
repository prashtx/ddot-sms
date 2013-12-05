/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * DEPRECATED
 * Use geocoder-yboss instead.
 *
 *
 * Geocode functionality using the Yahoo Placefinder geocoder
 */

var request = require('request');
var url = require('url');
var Q = require('q');

var apiUrl = 'http://where.yahooapis.com/geocode';
var appId = process.env.YDN_KEY || '';
var start = 0;
var count = 1;
var flags = 'J';

module.exports = (function () {
  var self = {};

  self.code = function (line1, line2) {
    var urlObj = url.parse(apiUrl);
    urlObj.query = {
      appid: appId,
      start: start.toString(),
      count: count.toString(),
      flags: flags,
      line1: line1,
      line2: line2
    };

    var def = Q.defer();
    request.get(url.format(urlObj), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status: ' + resp.statusCode));
        return;
      }

      try {
        var data = JSON.parse(body);
        var coords = {
          lat: data.ResultSet.Results[0].latitude,
          lon: data.ResultSet.Results[0].longitude,
          meta: {
            quality: data.ResultSet.Results[0].quality,
            service: 'Yahoo',
            line2: line2
          }
        };
        def.resolve(coords);
      } catch (e) {
        console.log('Caught exception getting data from Yahoo Placefinder:');
        console.log(e.message);
        console.log('Yahoo response body:');
        console.log(body);
        def.reject(e);
      }
    });

    return def.promise;
  };

  return self;
}());
