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

function record(user, event, properties) {
  // Ignore the default user ID, which we use for testing
  if (user === '0') {
    return;
  }

  kissClient.record(user, event, properties, kissHandler);
}

var metrics = {
  message: function (user) {
    record(user, 'Sent Message');
  },

  conversationContinue: function (user) {
    record(user, 'Continued Conversation');
  },

  stopID: function (user) {
    record(user, 'Sent Stop ID');
  },

  cacheMiss: function () {
    record('NO USER RECORDED', 'Cache Miss');
  },

  geocoder: function (geocoder) {
    record('NO USER RECORDED', 'Geocoder', { 'geocoder': geocoder} );
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
