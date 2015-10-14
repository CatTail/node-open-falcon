'use strict';

let os = require('os');
let http = require('http');
let request = require('request');
let util = require('util');
let EventEmitter = require('events').EventEmitter;

function Falcon() {
    this.endpoint = os.hostname();
}
util.inherits(Falcon, EventEmitter);

/**
 * url: Falcon push api
 * options
 *   [step]
 *   [counterType]
 *   [tags]
 *   [project]: project name, set as project=<project} tag
 *   [flush]: metric flush interval in seconds
 */
Falcon.prototype.init = function(url, options) {
    options = options || {};

    this.url = url;
    this.step = options.step || 60;
    this.counterType = options.counterType || "GAUGE";
    if (options.tags) {
        this.tags = options.tags;
    } else if (options.project) {
        this.tags = 'project=' + options.project;
    }

    this.metrics = [];
    let self = this;
    setInterval(function() {
        self.flush();
    }, (options.flush || 60) * 1000);
};

Falcon.prototype.push = function(metric, value, options) {
    options = options || {};
    options.tags = options.tags ? (','+options.tags) : '';
    this.metrics.push({
        metric,
        value,
        endpoint: this.endpoint,
        timestamp: Math.floor(Date.now() / 1000),
        step: options.step || this.step,
        counterType: options.counterType || this.counterType,
        tags: this.tags + options.tags,
    });
};

Falcon.prototype.flush = function() {
    let metrics = this.metrics;
    this.metrics = [];

    let self = this;
    request.post({
        url: this.url,
        body: JSON.stringify(metrics),
    }, function(err) {
        if (err) {
            self.emit('error', err);
        }
    });
};

module.exports = new Falcon();
