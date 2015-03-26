/// <reference path='../../typings/tsd.d.ts' />

import child = require('child_process');
import _ = require('lodash');
import debug = require('debug');
import Promise = require('bluebird');
import io = require('socket.io-client');

var log = debug('child_server:stdout');
// CONST
var SESSION_EXPIRATION: number = 3;
var MAXBUFFERSIZE: number = 3;
var POLL_TIMEOUT: number = 1000;
var CERTIFICATE_PATH: string = './temp';

type CleanUpFunction = (...args: any[]) => void|Promise<any>;

// GLOBAL
var cleanupFns: CleanUpFunction[] = [];

function createCertificate(): Promise<any>
{
    cleanupFns.push((): Promise<any> => {
        return (Promise.promisify(child.exec))('rm -rf ' + CERTIFICATE_PATH);
    });
    // TODO: Switch to execFileSync once migrated to Node 0.12
    return (Promise.promisify(child.execFile))('./scripts/gen_keys.sh',
                                               [CERTIFICATE_PATH],
                                               { stdio: 'ignore' });
}

export interface IOurSocket extends SocketIOClient.Socket {
    emitAcknowledge(event: string, arg?: any): Promise<void>;
}

export function startServer(https: boolean = false, testport: number = 3333): Promise<IOurSocket>
{
    var serverOptions = [
        './test/lib/test-index.js',
        '--port=3000',
        '--testport=' + testport,
        '--logging-stdoutLevel=debug'
    ];
    if (https) {
        serverOptions.push('--https-enable=true');
        serverOptions.push('--https-ca=../temp/ca-cert.pem');
        serverOptions.push('--https-cert=../temp/server-cert.pem');
        serverOptions.push('--https-key=../temp/server-key.pem');
        serverOptions.push('--logging-clientDetail=true');
        serverOptions.push('--session-expiration=' + SESSION_EXPIRATION);
        serverOptions.push('--longpoll-maxbuffersize=' + MAXBUFFERSIZE);
        serverOptions.push('--longpoll-polltimeout=' + POLL_TIMEOUT);
    }

    var p: Promise<any> = https ? createCertificate() : Promise.resolve();
    return p.then((): Promise<IOurSocket> => {
        var server = child.spawn('node',
                                 serverOptions,
                                 {
                                     stdio: [null, null, null, 'ipc']
                                 }
                                );
        cleanupFns.push(((s: child.ChildProcess): void => {
            s.kill();
        }).bind(this, server));

        server.stdout.on('data', (data: any): void => {
            log(data.toString());
        });
        server.stderr.on('data', (data: any): void => {
            log(data.toString());
        });
        server.on('close', (): void => {
            log('child process exited');
        });

        return (new Promise<IOurSocket>((resolve: (result: IOurSocket) => void,
                                         reject: (error: Error) => void): void => {
            server.on('message', (m: any): void => {
                // Connect the ipc socket once test server is ready
                var socket: any = io.connect('http://localhost:' + testport);
                socket.emitAcknowledge = (event: string, arg?: any): Promise<void> => {
                    return (new Promise<void>((resolve: () => void,
                                               reject: (error: Error) => void): void => {
                        var argument = arg || null;
                        socket.emit(event, argument, (): void => {
                            resolve();
                        });
                    }));
                };
                socket.on('connect', (): void => {
                    resolve(socket);
                });
            });
        }));
    });
}

export function stopServer(): Promise<any>
{
    return Promise.all(_.map(cleanupFns, (f: CleanUpFunction): void|Promise<any> => {
        return f();
    }));
}
