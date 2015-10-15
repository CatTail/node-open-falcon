'use strict';
let Falcon = require('..');
let debug = require('debug')('open-falcon:test');

describe('open-falcon', function() {
    this.timeout(5000);

    let api = 'http://localhost:6060';
    let project = 'projectName';
    Falcon.init(api, project);

    it('should initialize api and project', function(done) {
        let falcon = new Falcon({
            step: 0,
        });

        let metric =  'metricName'
        let value = 100;
        falcon.gauge(metric, value);

        getClientRequestBody(6060, function(queue) {
            queue[0].tags.should.equal('project='+project);
            queue[0].metric.should.equal(metric);
            queue[0].value.should.equal(value);
            done();
        });
    });

    it('should support GAUGE and COUNTER counterType', function(done) {
        let falcon = new Falcon({
            step: 0,
        });

        let metric =  'metricName'
        let value = 100;
        falcon.gauge(metric, value);

        getClientRequestBody(6060, function(queue) {
            queue[0].counterType.should.equal('GAUGE');

            falcon.counter(metric, value);
            getClientRequestBody(6060, function(queue) {
                queue[0].counterType.should.equal('COUNTER');
                done();
            });
        });
    });

    it('should support fake INCREMENT counterType', function(done) {
        let falcon = new Falcon();

        let metric = 'metricName';
        falcon
            .step(1)
            .increment(metric)
            .increment(metric);

        setTimeout(function() {
            falcon.increment(metric);
        }, 1000);

        getClientRequestBody(6060, function(queue) {
            queue[0].counterType.should.equal('GAUGE');
            queue[0].value.should.equal(2);

            done();
        });
    });

    it('should tag metric', function(done) {
        let falcon = new Falcon({
            step: 0,
        });

        let metric =  'metricName'
        let value = 100;
        falcon
            .tag('key', 'value')
            .gauge(metric, value);

        getClientRequestBody(6060, function(queue) {
            queue[0].tags.should.equal('project='+project+','+'key=value');
            done();
        });
    });

    it('should allow change step', function(done) {
        let falcon = new Falcon({
            step: 0,
        });

        let metric =  'metricName'
        let value = 100;
        falcon
            .step(1)
            .gauge(metric, value);

        getClientRequestBody(6060, function(queue) {
            queue[0].step.should.equal(1);
            done();
        });
    });
});

let http = require('http');
function getClientRequestBody(port, callback) {
    let server = http.createServer(function(req, res) {
        if(req.method === "POST"){
            let data = '';

            req.on('data', function(chunk){
                data += chunk;
            });
            req.on('end', function(){
                end();
                callback(JSON.parse(data));
            });
        } else {
            end();
        }

        function end() {
            res.end();
            server.close();
        }
    });
    server.listen(port);
}
