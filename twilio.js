/*jslint node: true */
'use strict';

var util = require('util');

// Make sure to escape the message appropriately for XML
var xmlSkeleton = '<?xml version="1.0" encoding="UTF-8"?><Response>%s</Response>';
var xmlSMS = '<Sms>%s</Sms>';

var escapeMap = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '\'': '&apos;',
  '"': '&quot;'
}

var escapeRE = /[<>&'"]/gm;

function escape(str) {
  if (!str) {
    return str;
  }
  return str.replace(escapeRE, function (match) {
    return escapeMap[match];
  });
}

module.exports = {
  sendTwiML: function sendTwiML(res, xml) {
    res.setHeader('Content-Type', 'text/xml');
    res.send(xml);
  },

  sms: function sms(message) {
    if (util.isArray(message)) {
      var multiSms = message.map(function (m) {
        return util.format(xmlSMS, escape(m));
      }).join('');
      return util.format(xmlSkeleton, multiSms);
    }
    
    if (message.length <= 160) {
      return util.format(xmlSkeleton, util.format(xmlSMS, escape(message)));
    }

    var done = false;
    var arr = [];
    var index;
    var remainder = message;
    while (!done) {
      if (remainder.length <= 160) {
        arr.push(remainder);
        done = true;
        break;
      }
      // TODO: look for newlines, not just spaces.
      index = remainder.lastIndexOf(' ', 159);
      if (index !== -1) {
        // Split at the last space.
        arr.push(remainder.substring(0, index));
        if (index + 2 < remainder.length) {
          remainder = remainder.substring(index + 1);
        } else {
          done = true;
        }
      } else {
        if (remainder.length <= 160) {
          // We didn't find a space, but the rest of the message is under 160
          // characters.
          arr.push(remainder);
          done = true;
        } else {
          // We didn't find a space, so we'll just split at the 160-character
          // mark.
          arr.push(remainder.substring(0, 159));
          remainder = remainder.substring(160);
        }
      }
    }

    return sms(arr);
  }
}

