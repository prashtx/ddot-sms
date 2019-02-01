/*jslint node: true, indent: 2, white: true, vars: true */

/*
 * Record events through KISSmetrics.
 */

"use strict";

function record(user, event, callback) {}

var metrics = {
  message: function(user) {
    record(user, "Sent Message");
  },

  conversationContinue: function(user) {
    record(user, "Continued Conversation");
  },

  stopID: function(user) {
    record(user, "Sent Stop ID");
  },

  cacheMiss: function() {
    record("NO USER RECORDED", "Cache Miss");
  }
};

module.exports = metrics;
