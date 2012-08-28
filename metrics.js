/*jslint node: true, indent: 2, white: true, vars: true */

/*
 * Record events through KISSmetrics.
 */

'use strict';

var KissClient = require('kissmetrics');

var kissKey = process.env.KISS_KEY;

var kissClient = new KissClient({ key: kissKey });

function kissHandler(err) {
  if (err) {
    console.log('KISSmetrics error: ' + err.message);
  }
}

function record(user, event, callback) {
  // Ignore the default user ID, which we use for testing
  if (user === '0') {
    return;
  }

  if (callback === undefined) {
    callback = kissHandler;
  }

  kissClient.record(user, event, callback);
}

var metrics = {
  message: function (user) {
    record(user, 'Sent Message', kissHandler);
  },

  conversationContinue: function (user) {
    record(user, 'Continued Conversation', kissHandler);
  },

  stopID: function (user) {
    record(user, 'Sent Stop ID', kissHandler);
  }

};

if (kissKey !== undefined) {
  module.exports = metrics;
} else {
  console.log('No KISSmetrics API key found. Disabling metrics.');
  var dummy = function () {};
  var f;
  for (f in metrics) {
    if (metrics.hasOwnProperty(f)) {
      module.exports[f] = dummy;
    }
  }
}
