/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Geocode functionality using the Yahoo Placefinder geocoder
 * Now powered by Yahoo BOSS
 */

var Q = require('q');
var OAuth = require('oauth');
var request = require('request');
var url = require('url');

// var apiUrl = 'http://where.yahooapis.com/geocode';
var geoSearchUrl = 'https://yboss.yahooapis.com/geo/placefinder';
var webSearchUrl = 'https://yboss.yahooapis.com/ysearch/web';

var key = process.env.YBOSS_KEY || '';
var secret = process.env.YBOSS_SECRET || '';

var start = 0;
var count = 1;
var flags = 'J';

module.exports = (function () {
  var self = {};

  self.code = function (line1, line2) {
    var urlObj = url.parse(geoSearchUrl);
    urlObj.query = {
      appid: appId,
      start: start.toString(),
      count: count.toString(),
      flags: flags,
      line1: line1,
      line2: line2
    };

    var def = Q.defer();

    var oa = new OAuth.OAuth(webSearchUrl, geoSearchUrl , consumerKey, consumerSecret, "1.0", null, "HMAC-SHA1");
    oa.setClientOptions({ requestTokenHttpMethod: 'GET' });
    oa.getProtectedResource(url.format(urlObj), "GET", '','', function(error, body, response) {
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
