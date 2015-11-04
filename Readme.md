# node-falcon

> open-falcon nodejs client

see [open-falcon data push section](http://book.open-falcon.com/zh/usage/data-push.html)

## Installation

    npm install --save open-falcon

## Usage

```js
'use strict';
let Falcon = require('open-falcon');
Falcon.init('http://127.0.0.1:6060');
// report memory usage every minutes
let falcon = new Falcon();
setInterval(function() {
    let usage = process.memoryUsage();
    falcon
        .step(20)
        .tag('type', 'memory')
        .gauge('node.mem.rss', usage.rss)
        .gauge('node.mem.total', usage.heapTotal)
        .gauge('node.mem.used', usage.heapUsed);
}, 1000 * 60);
```

## TODO

* Global waiting queue rather than every instance manage it's own metric queue

## License

MIT
