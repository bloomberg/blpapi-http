/// <reference path='typings/tsd.d.ts' />

import server = require('./lib/server');
import conf = require('./lib/config');

// Start servers
server.startServer();

// In case of config changes, shutdown the existing server and bring up a new one
conf.emitter.on('change', (): void => {
    server.stopServer()
        .then((): void => {
            server.startServer();
        });
});
