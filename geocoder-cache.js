/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

/*
 * Cache of geocoded locations
 * Just a stub right now. TODO: use a postgresql db to cache items
 */

var request = require('request');
var url = require('url');
var Q = require('q');

module.exports = (function () {
  var self = {};

  self.get = function (line1, line2) {
    return Q.fcall(function () {
      return null;
    });
  };

  self.add = function (line1, line2, coords) {
  };

  return self;
}());
