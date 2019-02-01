/*jslint node: true, indent: 2, white: true, vars: true */

/*
 * Cache of geocoded locations
 * Uses postgresql to cache items.
 */

"use strict";

var Q = require("q");
const { Client } = require("pg");

var databaseUrl = process.env.DATABASE_URL;
var maxCount = process.env.MAX_GEOCACHE_COUNT;
var maxKeyLength = 50;
var maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

if (maxCount === undefined) {
  maxCount = 9500;
}

/*
 * A cache entry has
 *  cacheKey : varchar(50)
 *  timestamp : timestamp
 *  lon : double precision
 *  lat : double precision
 *  count : integer
 */

module.exports = (function() {
  var self = {};

  // TODO: handle reconnecting if we lose the database connection
  console.log("Connectng to", databaseUrl);
  const client = new Client({
    connectionString: databaseUrl
  });

  client.connect(function(err) {
    if (err) {
      console.log(err.message);
    }
  });

  function query(queryInfo) {
    var def = Q.defer();
    client.query(queryInfo, def.makeNodeResolver());
    return def.promise;
  }

  client.query(
    {
      text:
        "CREATE TABLE IF NOT EXISTS geocoder_cache(" +
        "cacheKey varchar(50) PRIMARY KEY," +
        "timestamp timestamp," +
        "lon double precision, lat double precision," +
        "count integer DEFAULT 1)",
      name: "ensureTable"
    },
    function(err, result) {
      if (err) {
        throw err;
      } else {
        // Create an index on the timestamp column, so we can efficiently find
        // the oldest entries.
        query({
          text: "CREATE INDEX timestamp_idx ON geocoder_cache (timestamp)"
        }).fail(function(reason) {
          console.log("Failed to create timestamp index!");
          console.log(reason.message);
        });

        // Create an index on the count column, so we can efficiently look at
        // cache usage statistics.
        query({
          text: "CREATE INDEX count_idx ON geocoder_cache (count)"
        }).fail(function(reason) {
          console.log("Failed to create count index!");
          console.log(reason.message);
        });
      }
    }
  );

  // Take a two-line address and turn it into a normalized key for the cache.
  function makeCacheKey(line1, line2) {
    return (line1 + "," + line2)
      .toLowerCase()
      .trim()
      .replace(/[\s\n\r]+/g, " ");
  }

  // Check how many entries we have. If we've exceeded the maximum count,
  // remove the oldest entries.
  function enforceMaxCount() {
    query({
      text:
        "DELETE FROM geocoder_cache WHERE cacheKey in (SELECT cacheKey FROM geocoder_cache ORDER BY timestamp DESC LIMIT 1000 OFFSET $1);",
      values: [maxCount],
      name: "removeSurplus"
    }).then(function(result) {
      console.log(
        "Deleted " + result.rowCount + " cache entries to respect the limit."
      );
    });
  }

  // Remove an entry. Used when we've encountered a stale cache entry.
  function removeEntry(key) {
    query({
      text: "DELETE FROM geocoder_cache WHERE cacheKey=$1",
      values: [key],
      name: "removeEntry"
    });
  }

  // Get an entry from the cache.
  // Returns a promise.
  // Resolves with null if no valid entry was found, otherwise, resolves with a
  // lon-lat coordinate object.
  self.get = function get(line1, line2) {
    var cacheKey = makeCacheKey(line1, line2);

    // If the key is too long, then we know we didn't cache any such entry.
    if (cacheKey.length > maxKeyLength) {
      return Q.fcall(function() {
        return null;
      });
    }

    // Look up the cache key.
    return query({
      text:
        "SELECT lon, lat, count, timestamp FROM geocoder_cache WHERE cacheKey=$1",
      values: [cacheKey],
      name: "getEntry"
    })
      .then(function(result) {
        if (result.rows.length < 1) {
          // We didn't find a match in the cache.
          return null;
        }

        // We found a match.
        var entry = result.rows[0];

        // Check the age.
        if (entry.timestamp.getTime() + maxAge < Date.now()) {
          console.log("Found a stale cache entry");
          removeEntry(cacheKey);
          return null;
        }

        // Update the timestamp and count on the cache entry.
        var count = entry.count;
        query({
          text:
            "UPDATE geocoder_cache SET timestamp=$1, count=$2 WHERE cacheKey=$3",
          values: [new Date(), count + 1, cacheKey],
          name: "updateTimeCount"
        }).done();

        // Resolve with the coordinates.
        return {
          lon: entry.lon,
          lat: entry.lat,
          meta: {
            service: "cache"
          }
        };
      })
      .fail(function(err) {
        // If we encounter an error, then let the rest of the system continue as
        // though we had a cache miss.
        console.log("Error looking up cache entry:");
        console.log(err.message);
        return null;
      });
  };

  // Kick off the DB queries for updating or adding an entry, and then return.
  // We don't provide any feedback or allow the caller to wait for completion.
  self.add = function add(line1, line2, coords) {
    var cacheKey = makeCacheKey(line1, line2);

    // Update a cache entry if it exists already.
    query({
      text:
        "UPDATE geocoder_cache SET timestamp=$1, lon=$2, lat=$3, count=1 WHERE cacheKey=$4",
      values: [new Date(), coords.lon, coords.lat, cacheKey],
      name: "updateEntry"
    }).fail(function(reason) {
      console.log("Error conditionally updating a cache entry:");
      console.log(reason.message);
    });

    // Add an entry if one does not already exist.
    query({
      text:
        "INSERT INTO geocoder_cache (cacheKey, timestamp, lon, lat, count) VALUES ($4, $1, $2, $3, 1)",
      values: [new Date(), coords.lon, coords.lat, cacheKey],
      name: "addEntry"
    }).fail(function(reason) {
      console.log("Error conditionally adding a cache entry:");
      console.log(reason.message);
    });

    enforceMaxCount();
  };

  return self;
})();
