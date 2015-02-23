/// <reference path='../../typings/tsd.d.ts' />

import child = require('child_process');
import debug = require('debug');
import Promise = require('bluebird');
import MockWrapper = require('./mock-blpapi-wrapper');

var log = debug('child_server:stdout');

export function startServer(instructions: MockWrapper.IInstruction): Promise<child.ChildProcess>
{
    // Set blpSession Instructions
    process.env.WRAPPER_INSTRUCTIONS = JSON.stringify(instructions);
    var server = child.spawn('node',
                             ['./test/lib/test-index.js', '--port=3000'],
                             { stdio: [null, null, null, 'ipc'] });

    server.stdout.on('data', (data: any): void => {
        log(data.toString());
    });
    server.stderr.on('data', (data: any): void => {
        log(data.toString());
    });
    server.on('close', (): void => {
        log('child process exited');
    });

    return (new Promise<child.ChildProcess>((resolve: (result: child.ChildProcess) => void,
                                             reject: (error: Error) => void): void => {
        server.on('message', (m: any): void => {
            resolve(server);
        });
    }));
}

export function stopServer(p: Promise<child.ChildProcess>): Promise<void>
{
    return p.then((server: child.ChildProcess): void => {
        server.kill();
    });
}
