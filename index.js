'use strict';

let os = require('os');
let http = require('http');
let request = require('request');
let debug = require('debug')('open-falcon:index');

function getTrimedHostname() {
    let hostname = os.hostname();
    if (hostname.split('.').length) {
        return hostname.split('.')[0];
    }
    return hostname;
}

/**
 * var Falcon = require('open-falcon');
 * Falcon.init('http://localhost:6060', 'exampleProject');
 *
 * var falcon1 = new Falcon({
 *   tags: 'tagkey=tagvalue',
 * });
 *
 * falcon1
 *   .step(60)
 *   .tag('anotherkey', 'anothervalue')
 *   .gauge('metricName', 100);
 *
 * var falcon2 = new Falcon();
 * falcon2.counter('metricName2', 20);
 *
 * var falcon3 = new Falcon();
 * falcon3
 *   .step(20)
 *   .increment('incrementMetric');
 */

/**
 * options
 *   step: optional, integer, seconds, default 60
 *   counterType: optional, default 'GAUGE'
 *   tags: optional
 *   flush: optional, seconds, automatically flush timeout
 */
function Falcon(options) {
    debug('constructor', options);
    options = options || {};

    this._lock = false;
    this._queue = [];
    this._increment = null;

    // step trigger autoFlush
    this.step(options.step === undefined ? Falcon.DEFAULT_STEP : options.step);
    this.counterType(options.counterType === undefined ?
              Falcon.DEFAULT_COUNTER_TYPE : options.counterType);
    this.tag('project', Falcon.PROJECT);
    this._handler = options.handler || Falcon.DEFAULT_HANDLER;
    if (options.tags) {
        this.tag(options.tags);
    }
}

/**
 * api: Falcon push api
 * options
 *   project: project name, set as project=<project> tag
 */
Falcon.DEFAULT_STEP = 60;
Falcon.DEFAULT_COUNTER_TYPE = 'GAUGE';
Falcon.ENDPOINT = getTrimedHostname();

/**
 * @param {string} api
 * @param {string} project project name
 * @param {Function} handler optional request handler
 */
Falcon.init = function(api, project, handler) {
    debug('init', api, project);
    Falcon.API = api;
    Falcon.PROJECT = project;
    Falcon.DEFAULT_HANDLER = handler || function noop(){};
};

Falcon.prototype.now = function() {
    return Math.floor(Date.now() / 1000);
};

Falcon.prototype.tag = function(key, value) {
    debug('tag', key, value);
    if (this._lock) {
        this.emit('error', new Error('Falcon locked, can\'t alter tag'));
        return this;
    }

    if (!this._tags) {
        this._tags = '';
    } else {
        this._tags = this._tags + ',';
    }
    if (arguments.length === 2) {
        this._tags = this._tags + key + '=' + value;
    } else {
        this._tags = this._tags + key;
    }
    return this;
};

Falcon.prototype.step = function(step) {
    debug('step', step);
    if (this._lock) {
        this.emit('error', new Error('Falcon locked, can\'t alter step'));
        return this;
    }

    this._step = step;
    // autoFlush timeout should change everytime step changes
    this.autoFlush();
    return this;
};

Falcon.prototype.counterType = function(counterType) {
    debug('counterType', counterType);
    if (this._lock) {
        this.emit('error', new Error('Falcon locked, can\'t alter counterType'));
        return this;
    }

    this._counterType = counterType;
    return this;
};

Falcon.prototype.gauge = function(metric, value, options) {
    debug('gauge', metric, value, options);
    options = options || {};
    options.counterType = 'GAUGE';
    this.push(metric, value, options);
    return this;
};

Falcon.prototype.counter = function(metric, value, options) {
    debug('counter', metric, value, options);
    options = options || {};
    options.counterType = 'COUNTER';
    this.push(metric, value, options);
    return this;
};

Falcon.prototype.increment = function(metric, options) {
    debug('increment', metric, options);
    this._lock = true;
    options = options || {};
    options.counterType = 'INCREMENT';
    this.push(metric, 1, options);
    return this;
};

Falcon.prototype.push = function(metric, value, options) {
    options = options || {};
    options.tags = options.tags ? (','+options.tags) : '';

    let endpoint = Falcon.ENDPOINT;
    let timestamp = this.now();
    let step = options.step || this._step;
    let counterType = options.counterType || this._counterType;
    let tags = this._tags + options.tags;

    if (counterType === 'GAUGE' || counterType === 'COUNTER') {
        this._queue.push({
            metric,
            value,
            endpoint,
            timestamp,
            step,
            counterType,
            tags,
        });
    } else if (counterType === 'INCREMENT') {
        // reset fake counterType
        counterType = 'GAUGE';
        if (!this._increment) {
            this._increment = {
                metric,
                value,
                endpoint,
                timestamp,
                step,
                counterType,
                tags,
            };
        } else {
            this._increment.value = this._increment.value + 1;
        }
    }
    this.checkAndFlush();
    return this;
};

Falcon.prototype.autoFlush = function() {
    debug('autoFlush');
    clearTimeout(this._timeout);
    this.checkAndFlush();

    // if step equals to zero, reset it to 1
    let step = this._step || 1;
    let self = this;
    this._timeout = setTimeout(function() {
        self.autoFlush();
    }, step * 1000);
};

Falcon.prototype.checkAndFlush = function() {
    debug('checkAndFlush');
    let timestamp = this.now();
    if (this._increment) {
        if (timestamp - this._increment.timestamp >= this._step) {
            this._queue.push(this._increment);
            this._increment = null;
        }
    }

    if (this._queue.length) {
        if (timestamp - this._queue[0].timestamp >= this._step) {
            this.flush();
        }
    }
};

Falcon.prototype.flush = function() {
    debug('flush', this._queue);
    let queue = this._queue;
    if (!queue.length) {
        return;
    }
    this._queue = [];

    let self = this;
    request.post({
        url: Falcon.API,
        body: JSON.stringify(queue),
    }, this._handler)
        .on('error', this._handler);
};

module.exports = Falcon;
