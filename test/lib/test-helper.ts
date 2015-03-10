/// <reference path='../../typings/tsd.d.ts' />

import child = require('child_process');
import debug = require('debug');
import Promise = require('bluebird');
import io = require('socket.io-client');

var log = debug('child_server:stdout');

export interface IOurSocket extends SocketIOClient.Socket {
    emitAcknowledge(event: string, arg?: any): Promise<void>;
}

type ReturnValue = {
    server: child.ChildProcess;
    ipc: IOurSocket;
}

export function startServer(testport: number = 3333): Promise<ReturnValue>
{
    var server = child.spawn('node',
                             [
                                './test/lib/test-index.js',
                                '--port=3000',
                                '--testport=' + testport
                             ],
                             {
                                stdio: [null, null, null, 'ipc']
                             }
                            );

    server.stdout.on('data', (data: any): void => {
        log(data.toString());
    });
    server.stderr.on('data', (data: any): void => {
        log(data.toString());
    });
    server.on('close', (): void => {
        log('child process exited');
    });

    return (new Promise<ReturnValue>((resolve: (result: ReturnValue) => void,
                                      reject: (error: Error) => void): void => {
        server.on('message', (m: any): void => {
            // Connect the ipc socket once test server is ready
            var socket: any = io.connect('http://localhost:' + testport);
            socket.emitAcknowledge = (event: string, arg?: any): Promise<void> => {
                return (new Promise<void>((resolve: () => void,
                                           reject: (error: Error) => void): void => {
                    var argument = (2 === arguments.length) ? arg : null;
                    socket.emit(event, argument, (): void => {
                        resolve();
                    });
                }));
            };
            socket.on('connect', (): void => {
                resolve({
                    'server': server,
                    'ipc': socket
                });
            });
        });
    }));
}
