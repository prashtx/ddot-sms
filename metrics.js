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

var metrics = {
  message: function (user) {
    kissClient.record(user, 'Sent Message', kissHandler);
  },

  conversationContinue: function (user) {
    kissClient.record(user, 'Continued Conversation', kissHandler);
  },

  stopID: function (user) {
    kissClient.record(user, 'Sent Stop ID', kissHandler);
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
