/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Geocode functionality using the Yahoo Placefinder geocoder
 * Now powered by Yahoo BOSS
 */

var Q = require('q');
var request = require('request');
var url = require('url');

var geoSearchUrl = 'https://search.mapzen.com/v1/search';

var key = process.env.MAPZEN_KEY || '';

// Bounding box to restrict results.
// Roughly Detroit, plus some of Dearborn.
var min_lat = 42.2549507;
var min_lon = -83.3670043;
var max_lat = 42.5146262;
var max_lon = -82.8465270;

// https://search.mapzen.com/v1/search?api_key=search-xxx&text=1%20woodward%20avenue%20detroit%20mi&boundary.rect.min_lat=42.2549507&boundary.rect.min_lon=-82.8465270&boundary.rect.max_lat=42.5146262&boundary.rect.max_lon=-83.3670043

module.exports = (function () {
  var self = {};

  self.code = function (line1, line2) {
    var urlObj = url.parse(geoSearchUrl);
    urlObj.query = {
      'boundary.rect.min_lat': min_lat,
      'boundary.rect.max_lat': max_lat,
      'boundary.rect.min_lon': min_lon,
      'boundary.rect.max_lon': max_lon,
      text: line1 + ' ' + line2,
      api_key: key
    };

    var def = Q.defer();
    request.get(url.format(urlObj), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(error || new Error('Received status from mapzen: ' + resp.statusCode));
        return;
      }

      var data = JSON.parse(body);
      if (data.features.length > 0) {

        // Reject weak responses.
        if (data.features[0].properties.confidence < 0.85) {
          def.reject(new Error('Geocoder returned no high-quality results'));
          return;
        }

        var coords = {
          lat: data.features[0].geometry.coordinates[1],
          lon: data.features[0].geometry.coordinates[0],
          meta: {
            service: 'Mapzen',
            quality: data.features[0].properties.confidence
          }
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
