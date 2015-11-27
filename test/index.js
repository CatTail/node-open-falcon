'use strict'
var Falcon = require('..')
var debug = require('debug')('open-falcon:test')
var async = require('async')

describe('open-falcon', function() {
    this.timeout(50000)

    var api = 'http://localhost:6060'
    var project = 'projectName'
    Falcon.init(api, project)

    it('should initialize api and project', function(done) {
        var falcon = new Falcon({
            step: 0,
        })

        var metric =  'metricName'
        var value = 100
        falcon.gauge(metric, value)

        getClientRequestBody(6060, function(queue) {
            queue[0].tags.should.equal('project='+project)
            queue[0].metric.should.equal(metric)
            queue[0].value.should.equal(value)
            done()
        })
    })

    it('should support GAUGE and COUNTER counterType', function(done) {
        var falcon = new Falcon({
            step: 0,
        })

        var metric =  'metricName'
        var value = 100
        falcon.gauge(metric, value)

        getClientRequestBody(6060, function(queue) {
            queue[0].counterType.should.equal('GAUGE')

            falcon.counter(metric, value)
            getClientRequestBody(6060, function(queue) {
                queue[0].counterType.should.equal('COUNTER')
                done()
            })
        })
    })

    it('should support fake INCREMENT counterType', function(done) {
        var falcon = new Falcon()

        var metric = 'metricName'
        falcon
            .step(1)
            .increment(metric)
            .increment(metric)

        setTimeout(function() {
            falcon.increment(metric)
        }, 1000)

        getClientRequestBody(6060, function(queue) {
            queue[0].counterType.should.equal('GAUGE')
            queue[0].value.should.equal(2)

            falcon.destroy()
            done()
        })
    })

    it('should support multiple INCREMENT on single falcon instance', function(done) {
        var falcon = new Falcon()

        var metric1 = 'metricName1'
        var metric2 = 'metricName2'
        falcon
            .step(1)
            .increment(metric1)
            .increment(metric2)
            .increment(metric1)

        getClientRequestBody(6060, function(queue) {
            queue[0].counterType.should.equal('GAUGE')
            queue[0].value.should.equal(2)
            queue[1].counterType.should.equal('GAUGE')
            queue[1].value.should.equal(1)

            done()
        })
    })

    it('should tag metric', function(done) {
        var falcon = new Falcon({
            step: 0,
        })

        var metric =  'metricName'
        var value = 100
        falcon
            .tag('key', 'value')
            .gauge(metric, value)

        getClientRequestBody(6060, function(queue) {
            queue[0].tags.should.equal('project='+project+','+'key=value')
            done()
        })
    })

    it('should allow change step', function(done) {
        var falcon = new Falcon({
            step: 0,
        })

        var metric =  'metricName'
        var value = 100
        falcon
            .step(1)
            .gauge(metric, value)

        getClientRequestBody(6060, function(queue) {
            queue[0].step.should.equal(1)
            done()
        })
    })
})

var http = require('http')
function getClientRequestBody(port, callback) {
    var server = http.createServer(function(req, res) {
        if(req.method === "POST"){
            var data = ''

            req.on('data', function(chunk){
                data += chunk
            })
            req.on('end', function(){
                end()
                callback(JSON.parse(data))
            })
        } else {
            end()
        }

        function end() {
            res.end()
            server.close()
        }
    })
    server.listen(port)
}
