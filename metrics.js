/*jslint node: true, indent: 2, white: true, vars: true */

/*
 * Record events through KISSmetrics.
 */

"use strict";

function record(user, event, callback) {}

var metrics = {
  message: function(user) {
    record(user, "Sent Message", kissHandler);
  },

  conversationContinue: function(user) {
    record(user, "Continued Conversation", kissHandler);
  },

  stopID: function(user) {
    record(user, "Sent Stop ID", kissHandler);
  },

  cacheMiss: function() {
    record("NO USER RECORDED", "Cache Miss", kissHandler);
  }
};

module.exports = metrics;
