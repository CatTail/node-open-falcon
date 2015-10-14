'use strict';

let os = require('os');
let http = require('http');
let request = require('request');
let util = require('util');
let EventEmitter = require('events').EventEmitter;

function Falcon(options) {
    options = options || {};

    this._step = options.step || Falcon.DEFAULT_STEP;
    this._counterType = options.counterType || Falcon.DEFAULT_COUNTER_TYPE;

    this._tags = Falcon.PROJECT_TAG;
    if (options.tags) {
        this._tags = this._tags + ',' + options.tags;
    }

    this._metrics = [];
}
util.inherits(Falcon, EventEmitter);

/**
 * api: Falcon push api
 * options
 *   project: project name, set as project=<project} tag
 */
Falcon.DEFAULT_STEP = 60;
Falcon.DEFAULT_COUNTER_TYPE = 'GAUGE';
Falcon.ENDPOINT = os.hostname();
Falcon.init = function(api, options) {
    Falcon.API = api;
    Falcon.PROJECT_TAG = 'project=' + options.project;
};

Falcon.prototype.push = function(metric, value, options) {
    options = options || {};
    options.tags = options.tags ? (','+options.tags) : '';
    this._metrics.push({
        metric,
        value,
        endpoint: Falcon.ENDPOINT,
        timestamp: Math.floor(Date.now() / 1000),
        step: options.step || this._step,
        counterType: options.counterType || this._counterType,
        tags: this._tags + options.tags,
    });
    // TODO: auto flush logic
};

// [flush]: metric flush interval in seconds
Falcon.prototype.flush = function() {
    let metrics = this.metrics;
    if (!metrics.length) {
        return;
    }
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

Falcon.prototype.tag = function(key, value) {
    this._tags = this._tags + ',' + key + '=' + value;
};

Falcon.prototype.step = function(step) {
    this._step = step;
};

Falcon.prototype.gauge = function(metric, value, options) {
    this._counterType = 'GAUGE';
    this.push(metric, value, options);
};

Falcon.prototype.counter = function(metric, value, options) {
    this._counterType = 'COUNTER';
    this.push(metric, value, options);
};

Falcon.prototype.increment = function(metric, options) {
    this._counterType = 'GAUGE';
    // TODO;
    this.push(metric, options);
};

module.exports = new Falcon();
