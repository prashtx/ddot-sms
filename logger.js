/*jslint node: true*/

/*
 * Log activity to a web service
 */

'use strict';

var request = require('request');
var Q = require('q');

var logURL = process.env.LOGGER_URL;

var Entry = {
  data: {},
  send: function () {
    var def = Q.defer();

    if (logURL === undefined) {
      def.resolve();
      return def.promise;
    }

    request.post({
      url: logURL,
      json: this.data
    }, def.makeNodeResolver());
    return def.promise;
  }
};

function makeEntry(user) {
  var entry = Object.create(Entry);
  entry.data.user = user;
}

module.exports = {
  makeEntry: makeEntry
}
