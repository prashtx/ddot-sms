/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var request = require('request');
var Q = require('q');

var API = 'http://ec2-23-22-140-30.compute-1.amazonaws.com:3001/api/api/where/';
var API_KEY = 'TEST';
var AGENCY = 'Detroit Department of Transportation';

function apiUrl(endpoint, id) {
  return API + endpoint + '/' + id + '.json?key=' + API_KEY;
}

module.exports = (function () {
  var self = {};

  self.getRoutes = function () {
    var def = Q.defer();
    request.get(apiUrl('routes-for-agency', AGENCY), function(error, resp, body) {
      if (error) {
        def.reject();
        return;
      }
      var data = JSON.parse(body);
      var routes = data
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
          id: item.id
        };
      });
      def.resolve(data.data.list);
    });

    return def.promise;
  };

  return self;
}());
