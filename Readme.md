# node-falcon

> open-falcon nodejs client

see [open-falcon data push section](http://book.open-falcon.com/zh/usage/data-push.html)

## Installation

    npm install --save open-falcon

## Usage

    var falcon = require('open-falcon');
    falcon.init('http://127.0.0.1:6060');
    // report memory usage every minutes
    setInterval(function() {
        let usage = process.memoryUsage();
        falcon.push('node.mem.rss', usage.rss);
        falcon.push('node.mem.total', usage.heapTotal);
        falcon.push('node.mem.used', usage.heapUsed);
    }, 1000 * 60);

## License

MIT
