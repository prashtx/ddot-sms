/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var url = require('url');

var request = require('request');
var Q = require('q');

var API = 'http://ec2-23-22-140-30.compute-1.amazonaws.com:3001/api/api/where/';
var API_KEY = 'TEST';
var AGENCY = 'Detroit Department of Transportation';

function apiUrl(endpoint, id, query) {
  var urlObj;
  if (id) {
    urlObj = url.parse(API + endpoint + '/' + id + '.json');
  } else {
    urlObj = url.parse(API + endpoint + '.json');
  }

  if (query) {
    urlObj.query = query;
  } else {
    urlObj.query = {};
  }

  if (urlObj.query.key === undefined) {
    urlObj.query.key = API_KEY;
  }

  //return encodeURI(API + endpoint + '/' + id + '.json?key=' + API_KEY);
  return encodeURI(url.format(urlObj));
}

function distance(a, b) {
  var x = parseFloat(a.lat) - parseFloat(b.lat);
  var y = parseFloat(a.lon) - parseFloat(b.lon);
  return Math.sqrt((x * x) + (y * y));
}

module.exports = (function () {
  var self = {};

  self.getRoutes = function () {
    var def = Q.defer();
    //request.get(apiUrl('routes-for-agency', AGENCY), function(error, resp, body) {
    request.get(apiUrl('routes-for-agency', AGENCY), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject();
        return;
      }

      var data = JSON.parse(body);
      var routes = data.data.list
      .sort(function (a, b) {
        var x = parseInt(a.shortName, 10);
        var y = parseInt(b.shortName, 10);
        if (x < y) { return -1; }
        if (x > y) { return 1; }
        return 0;
      })
      .map(function (item) {
        return {
          name: item.shortName + ' ' + item.longName,
          shortName: item.shortName,
          id: item.id
        };
      });
      def.resolve(routes);
    });

    return def.promise;
  };

  self.getStopsForLocation = function (coords) {
    var def = Q.defer();

    request.get(apiUrl('stops-for-location', null, coords),
                function (error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject();
        return;
      }

      var data = JSON.parse(body);
      def.resolve(data.data.list.sort(function (a, b) {
        return distance(coords, a) - distance(coords, b);
      }));
    });

    return def.promise;
  };

  return self;
}());
