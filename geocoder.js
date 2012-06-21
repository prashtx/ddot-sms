/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

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
        def.reject();
        return;
      }

      var data = JSON.parse(body);
      var coords = {
        lat: data.ResultSet.Results[0].latitude,
        lon: data.ResultSet.Results[0].longitude
      };
      def.resolve(coords);
    });

    return def.promise;
  };

  return self;
}());
