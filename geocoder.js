/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Multi-service geocoder.
 * Uses a cache to store geocoder results. For cache misses, tries the Google
 * Maps API. If we've reached the Google Maps rate limit, then tries the
 * City of Detroit's geocoder.
 */

var google = require("./geocoder-google.js");
var detroitGeocoder = require("./geocoder-detroit.js");
var cache = require("./geocoder-cache.js");
var metrics = require("./metrics.js");

var detroit = "Detroit, MI";
var dearborn = "Dearborn, MI";
var highlandpark = "Highland Park, MI";
var hamtramck = "Hamtramck, MI";
var harperwoods = "Harper Woods, MI";

module.exports = (function() {
  var self = {};

  self.detroitCode = function(line1) {
    return detroitGeocoder
      .code(line1)
      .then(function(coords) {
        cache.add(line1, detroit, coords);
        console.log("Geocoder: using Detroit");
        return coords;
      })
      .fail(function(reason) {
        console.log("Detroit geocoder failed", reason);
      });
  };

  self.googleCode = function(line1) {
    return google
      .code(line1, detroit)
      .then(function(coords) {
        cache.add(line1, detroit, coords);
        console.log("Geocoder: using Google Maps");
        return coords;
      })
      .fail(function(reason) {
        console.log(reason.message);
        if (reason.name === "BadLocationError") {
          // If Google choked on this location, then try outside Detroit-proper.
          return google
            .code(line1, dearborn)
            .then(function(coords) {
              // Add to cache with detroit, since that's how we'll look it up next
              // time.
              cache.add(line1, detroit, coords);
              console.log("Geocoder: using Google Maps Dearborn");
              return coords;
            })
            .fail(function(reason) {
              console.log(reason.message);
              // If we still get a bad location, then give up.
              if (reason.name === "BadLocationError") {
                throw reason;
              }
              // We've used Google too recently or something went wrong. Try mapzen.
              return self.detroitCode(line1);
            });
        }

        // We've used Google too recently or something went wrong. Try mapzen.
        return self.detroitCode(line1);
      });
  };

  self.code = function(line1) {
    // Check the cache
    return cache.get(line1, detroit).then(
      function(cachedCoords) {
        if (cachedCoords !== null) {
          console.log("Geocoder: using cache");
          return cachedCoords;
        }

        // Cache miss. Try Google Maps.
        metrics.cacheMiss();
        return self.googleCode(line1);
      },
      function(reason) {
        // Cache error.
        console.log("Error in cache.get:");
        console.log(reason.message);

        // Try Google Maps.
        return self.googleCode(line1);
      }
    );
  };

  return self;
})();
