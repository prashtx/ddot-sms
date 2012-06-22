/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var url = require('url');

var request = require('request');
var Q = require('q');

//var API = 'http://ec2-23-22-140-30.compute-1.amazonaws.com:3001/api/api/where/';
var API = process.env.OBA_API;
var API_KEY = 'TEST';
var AGENCY = 'Detroit Department of Transportation';

// Prepend the agency ID to the item ID, unless it's already there.
// So '1723' becomes 'Detroit Department of Transportation_1723'
function makeFullId(id) {
  if (id.length > AGENCY.length && id.substring(0, AGENCY.length) === AGENCY) {
    return id;
  }
  return AGENCY + '_' + id;
}

function apiUrl(endpoint, id, query) {
  var urlObj;
  if (id) {
    urlObj = url.parse(encodeURI(API + endpoint + '/' + id + '.json'));
  } else {
    urlObj = url.parse(encodeURI(API + endpoint + '.json'));
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
  return url.format(urlObj);
}

function distance(a, b) {
  function strToRad(str) {
    return parseFloat(str) * Math.PI / 180;
  }
  var R = 6371;
  var alon = strToRad(a.lon);
  var blon = strToRad(b.lon);
  var alat = strToRad(a.lat);
  var blat = strToRad(b.lat);
  var x = (alon - blon) * Math.cos((alat + blat) / 2);
  var y = alat - blat;
  return Math.sqrt((x * x) + (y * y)) * R;
}

module.exports = (function () {
  var self = {};

  // Get all of the routes, sorted.
  // Each entry contains name, shortName, and id.
  self.getRoutes = function () {
    var def = Q.defer();
    //request.get(apiUrl('routes-for-agency', AGENCY), function(error, resp, body) {
    request.get(apiUrl('routes-for-agency', AGENCY), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status ' + resp.statusCode));
        return def.promise;
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

  // Get stops near coords.lon, coords.lat, sorted by distance from the
  // specified location.
  self.getStopsForLocation = function (coords) {
    var def = Q.defer();

    request.get(apiUrl('stops-for-location', null, coords),
                function (error, resp, body) {
      if (error) {
        def.reject(error);
        return def.promise;
      }
      if (resp.statusCode !== 200) {
        def.reject(new Error('Received status ' + resp.statusCode));
        return def.promise;
      }

      var data = JSON.parse(body);
      def.resolve(data.data.list.sort(function (a, b) {
        return distance(coords, a) - distance(coords, b);
      }));
    });

    return def.promise;
  };

  // Get stop details by stop ID.
  self.getStop = function (stopId) {
    var def = Q.defer();

    request.get(apiUrl('stop', stopId), function (error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status ' + resp.statusCode));
        return def.promise;
      }

      var data = JSON.parse(body);
      def.resolve(data.data.entry);
    });

    return def.promise;
  };

  // Get arrival info for the specified stop.
  self.getArrivalsForStop = function (stopId) {
    var def = Q.defer();

    var query = {
      minutesBefore: 0,
      minutesAfter: 90
    };
    request.get(apiUrl('arrivals-and-departures-for-stop', makeFullId(stopId), query),
                function (error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status ' + resp.statusCode));
        return def.promise;
      }

      var data = JSON.parse(body);
      var now = data.currentTime;
      var arrivals = data.data.entry.arrivalsAndDepartures
      .map(function (entry) {
        var arrival = entry.scheduledArrivalTime;
        var predicted = entry.predicted;
        if (predicted) {
          arrival = entry.predictedArrivalTime;
        }
        return {
          arrival: arrival,
          predicted: predicted,
          headsign: entry.tripHeadsign,
          routeShortName: entry.routeShortName,
          routeLongName: entry.routeLongName
        };
      })
      .sort(function (a, b) { return a.arrival - b.arrival; });
      def.resolve({
        now: now,
        arrivals: arrivals
      });
    });

    return def.promise;
  };

  return self;
}());
