/// <reference path='../../typings/tsd.d.ts' />

import child = require('child_process');
import Promise = require('bluebird');
import MockWrapper = require('./mock-blpapi-wrapper');

export function startServer(instructions: MockWrapper.IInstruction): Promise<child.ChildProcess>
{
    // Set blpSession Instructions
    process.env.WRAPPER_INSTRUCTIONS = JSON.stringify(instructions);
    var server = child.spawn('node',
                             ['./lib/test-infrastructure/test-index.js', '--port=3000'],
                             { stdio: [null, null, null, 'ipc'] });
/*
    server.stdout.on('data', (data: any): void => {
      console.log('stdout: ' + data);
    });
    server.stderr.on('data', (data: any): void => {
      console.log('stderr: ' + data);
    });
    server.on('close', (data: any): void => {
      console.log('child process exited with code ' + data);
    });
*/
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
