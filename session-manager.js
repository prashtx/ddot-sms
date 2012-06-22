/*jslint node: true, indent: 2, sloppy: true, white: true, vars: true */

var Q = require('q');

// TODO: use redis or something else to store session state

module.exports = (function () {
  var self = {};

  var sessions = {};

  // 5 minute lifetime on sessions.
  var lifetime = 5 * 60 * 1000;

  // context.type
  // context.choices
  // context.actions
  // context.params
  function makeEntry(caller, context) {
    return {
      context: context,
      caller: caller,
      time: Date.now()
    };
  }

  // Set and forget
  self.save = function (caller, context) {
    sessions[caller] = makeEntry(caller, context);
  };

  // Use a Deferred. We reserve the right go to asynchronous.
  self.get = function (caller) {
    var def = Q.defer();

    if (sessions.hasOwnProperty(caller)) {
      def.resolve(sessions[caller]);
    } else {
      def.resolve(null);
    }

    return def.promise;
  };

  // Clean the old sessions.
  setInterval(function () {
    var entry;
    var now = Date.now();
    for (entry in sessions) {
      if (sessions.hasOwnProperty(entry)) {
        if (entry.time + lifetime < now) {
          delete sessions.entry;
        }
      }
    }
  }, 30 * 1000); // 30 seconds.

  return self;
}());
