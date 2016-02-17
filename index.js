'use strict'

var os = require('os')
var http = require('http')
var request = require('request')
var debug = require('debug')('open-falcon:index')

function getTrimedHostname() {
    var hostname = os.hostname()
    if (hostname.split('.').length) {
        return hostname.split('.')[0]
    }
    return hostname
}

/**
 * var Falcon = require('open-falcon')
 * Falcon.init('http://localhost:6060', 'exampleProject')
 *
 * var falcon1 = new Falcon({
 *   tags: 'tagkey=tagvalue',
 * })
 *
 * falcon1
 *   .step(60)
 *   .tag('anotherkey', 'anothervalue')
 *   .gauge('metricName', 100)
 *
 * var falcon2 = new Falcon()
 * falcon2.counter('metricName2', 20)
 *
 * var falcon3 = new Falcon()
 * falcon3
 *   .step(20)
 *   .increment('incrementMetric1')
 *   .increment('incrementMetric2')
 */

/**
 * options
 *   step: optional, integer, seconds, default 60
 *   tags: optional
 */
function Falcon(options) {
    debug('constructor', options)
    options = options || {}

    this._lock = false
    this._queue = []
    this._increment = {}

    // step trigger autoFlush
    this.step(options.step === undefined ? Falcon.DEFAULT_STEP : options.step)
    if (Falcon.PROJECT) {
        this.tag('project', Falcon.PROJECT)
    }
    this._handler = options.handler || Falcon.DEFAULT_HANDLER
    if (options.tags) {
        this.tag(options.tags)
    }
}

/**
 * api: Falcon push api
 * options
 *   project: project name, set as project=<project> tag
 */
Falcon.DEFAULT_STEP = 60
Falcon.DEFAULT_COUNTER_TYPE = 'GAUGE'
Falcon.ENDPOINT = getTrimedHostname()

/**
 * @param {string} api
 * @param {string} project project name
 * @param {Function} handler optional request handler
 */
Falcon.init = function(api, project, handler) {
    debug('init', api, project)
    Falcon.API = api
    Falcon.PROJECT = project
    Falcon.DEFAULT_HANDLER = handler || function noop(){}
    return Falcon
}

Falcon.prototype.destroy = function() {
    debug('destroy')
    clearTimeout(this._timeout)
}

Falcon.prototype.tag = function(key, value) {
    debug('tag', key, value)
    if (this._lock) {
        this.emit('error', new Error('Falcon locked, can\'t alter tag'))
        return this
    }

    if (!this._tags) {
        this._tags = ''
    } else {
        this._tags = this._tags + ','
    }
    if (arguments.length === 2) {
        this._tags = this._tags + key + '=' + value
    } else {
        this._tags = this._tags + key
    }
    return this
}

Falcon.prototype.step = function(step) {
    debug('step', step)
    if (this._lock) {
        this.emit('error', new Error('Falcon locked, can\'t alter step'))
        return this
    }

    this._step = step
    // autoFlush timeout should change everytime step changes
    this.autoFlush()
    return this
}

Falcon.prototype.gauge = function(metric, value, options) {
    debug('gauge', metric, value, options)
    options = options || {}
    options.counterType = 'GAUGE'
    this.push(metric, value, options)
    return this
}

Falcon.prototype.counter = function(metric, value, options) {
    debug('counter', metric, value, options)
    options = options || {}
    options.counterType = 'COUNTER'
    this.push(metric, value, options)
    return this
}

Falcon.prototype.increment = function(metric, options) {
    debug('increment', metric, options)
    options = options || {}
    options.counterType = 'INCREMENT'
    this.push(metric, 1, options)
    return this
}

/**
 * @private
 */
Falcon.prototype.now = function() {
    return Math.floor(Date.now() / 1000)
}

/**
 * @private
 */
Falcon.prototype.createItem = function(metric, value, options) {
    options.tags = options.tags ? (','+options.tags) : ''

    var endpoint = options.endpoint || Falcon.ENDPOINT
    var timestamp = this.now()
    var step = options.step || this._step
    var counterType = options.counterType
    var tags = this._tags + options.tags

    if (counterType === 'INCREMENT') {
        // reset fake counterType
        counterType = 'GAUGE'
    }

    return {
        metric: metric,
        value: value,
        endpoint: endpoint,
        timestamp: timestamp,
        step: step,
        counterType: counterType,
        tags: tags,
    }
}

/**
 * @private
 */
Falcon.prototype.push = function(metric, value, options) {
    var counterType = options.counterType || Falcon.DEFAULT_COUNTER_TYPE
    if (counterType === 'GAUGE' || counterType === 'COUNTER') {
        this._queue.push(this.createItem(metric, value, options))
    } else if (counterType === 'INCREMENT') {
        if (!this._increment[metric]) {
            this._increment[metric] = this.createItem(metric, value, options)
        } else {
            this._increment[metric].value = this._increment[metric].value + 1
        }
    }
    this.checkAndFlush()
    return this
}

/**
 * @private
 */
Falcon.prototype.autoFlush = function() {
    debug('autoFlush')
    clearTimeout(this._timeout)
    this.checkAndFlush()

    // if step equals to zero, reset it to 1
    var step = this._step || 1
    var self = this
    this._timeout = setTimeout(function() {
        self.autoFlush()
    }, step * 1000)
}

/**
 * @private
 */
Falcon.prototype.checkAndFlush = function() {
    debug('checkAndFlush')
    var timestamp = this.now()
    for (var metric in this._increment) {
        var increment = this._increment[metric]
        if (timestamp - increment.timestamp >= this._step) {
            this._queue.push(increment)
            // reset increment rather than delete it
            this._increment[metric] = this.createItem(increment.metric, 0, {counterType: 'INCREMENT'})
        }
    }

    if (this._queue.length) {
        if (timestamp - this._queue[0].timestamp >= this._step) {
            this.flush()
        }
    }
}

/**
 * @private
 */
Falcon.prototype.flush = function() {
    debug('flush', this._queue)
    var queue = this._queue
    if (!queue.length) {
        return
    }
    this._queue = []

    var self = this
    request.post({
        url: Falcon.API,
        body: JSON.stringify(queue),
    }, this._handler)
        .on('error', this._handler)
}

module.exports = Falcon
