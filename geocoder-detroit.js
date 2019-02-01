/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * The City of Detroit's geocoder
 */

var Q = require("q");
var request = require("request");
var url = require("url");

var geoSearchUrl =
  "http://gis.detroitmi.gov/arcgis/rest/services/DoIT/CompositeGeocoder/GeocodeServer/findAddressCandidates";

// http://gis.detroitmi.gov/arcgis/rest/services/DoIT/CompositeGeocoder/GeocodeServer/findAddressCandidates?Street=sunderland+%26+mcnichols&City=&ZIP=&SingleLine=&category=&outFields=&maxLocations=&outSR=4326&searchExtent=&location=&distance=&magicKey=&f=pjson
// SingleLine

module.exports = (function() {
  var self = {};

  self.code = function(line1) {
    var urlObj = url.parse(geoSearchUrl);
    urlObj.query = {
      SingleLine: line1,
      f: "pjson",
      outSR: "4326"
    };

    var def = Q.defer();
    request.get(url.format(urlObj), function(error, resp, body) {
      if (error || resp.statusCode !== 200) {
        def.reject(
          error ||
            new Error(
              "Received status from Detroit Geocoder: " + resp.statusCode
            )
        );
        return;
      }

      var data = JSON.parse(body);

      if (!data.candidates || data.candidates.length === 0) {
        def.reject(new Error("Geocoder returned no results"));
        return;
      }

      var topResult = data.candidates[0];

      if (topResult.score < 50) {
        def.reject(new Error("Geocoder returned no high-quality results"));
        return;
      }

      var coords = {
        lat: topResult.location.y,
        lon: topResult.location.x,
        meta: {
          service: "Detroit",
          quality: topResult.score
        }
      };
      def.resolve(coords);
      return;
    });

    return def.promise;
  };

  return self;
})();
