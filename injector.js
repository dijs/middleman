'use strict';

var trumpet = require('trumpet');
var through = require('through');

function injector(selector, data) {
  var tr = trumpet();
  var element = tr.createStream(selector);
  element
    .pipe(through(
      null,
      function() {
        this.queue(data || '');
        this.queue(null);
      }))
    .pipe(element);
  return tr;
}

module.exports = injector;