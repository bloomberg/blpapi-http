import fs = require('fs');
import path = require('path');
import convict = require('convict');
import bunyan = require('bunyan');
import optimist = require('optimist');

export = Config;

class Config {
    private static convictConf: convict.Config;
    private static otherConf: {[index: string]: any};

    // Private static constructor
    private static _constructor = ((): void => {
        Config.otherConf = {};

        // Convict from file
        Config.convictConf = convict({
            'api': {
                'host': {
                    doc: 'The Bloomberg Open API server address',
                    format: 'ipaddress',
                    default: '127.0.0.1',
                    env: 'BLPAPI_HTTP_API_HOST',
                    arg: 'api-host'
                },
                'port': {
                    doc: 'The Bloomberg Open API server port',
                    format: 'port',
                    default: 8194,
                    env: 'BLPAPI_HTTP_API_PORT',
                    arg: 'api-port'
                }
            },
            'port': {
                doc: 'The http port to listen on',
                format: 'port',
                default: 80,
                env: 'BLPAPI_HTTP_PORT',
                arg: 'port'
            },
            'expiration' : {
                doc: 'Auto-expiration period of session in seconds',
                format: 'integer',
                default: 5
            },
            'https': {
                'enable': {
                    doc: 'Boolean option to control whether the server runs on https mode',
                    format: Boolean,
                    default: false,
                    arg: 'https-enable'
                },
                'ca': {
                    doc: 'HTTPS server ca',
                    format: String,
                    default: '../keys/bloomberg-ca-crt.pem',
                    arg: 'https-ca'
                },
                'cert': {
                    doc: 'HTTPS server certification',
                    format: String,
                    default: '../keys/hackathon-crt.pem',
                    arg: 'https-cert'
                },
                'key': {
                    doc: 'HTTPS server key',
                    format: String,
                    default: '../keys/hackathon-key.pem',
                    arg: 'https-key'
                }
            },
            'logging': {
                'stdout': {
                    doc: 'Boolean option to control whether to log to stdout',
                    format: Boolean,
                    default: true,
                    arg: 'logging-stdout'
                },
                'stdoutLevel': {
                    doc: 'Log level to for stdout',
                    format: String,
                    default: 'info',
                    arg: 'logging-stdoutLevel'
                },
                'logfile': {
                    doc: 'Log file path',
                    format: String,
                    default: 'blpapi-http.log',
                    arg: 'logging-logfile'
                },
                'logfileLevel': {
                    doc: 'Log level to for log file',
                    format: String,
                    default: 'trace',
                    arg: 'logging-logfileLevel'
                },
                'reqBody': {
                    doc: 'Boolean option to control whether to log request body',
                    format: Boolean,
                    default: false,
                    arg: 'logging-reqBody'
                },
                'clientDetail': {
                    doc: 'Boolean option to control whether to log client details',
                    format: Boolean,
                    default: false,
                    arg: 'logging-clientDetail'
                }
            },
            'service': {
                'name': {
                    doc: 'The service name',
                    format: String,
                    default: 'BLPAPI-HTTP',
                    arg: 'service-name'
                },
                'version': {
                    doc: 'The service version',
                    format: String,
                    default: '1.0.0',
                    arg: 'service-version'
                }
            },
            'maxBodySize': {
                doc: 'Maximum size of the request body in byte',
                format: 'integer',
                default: 1024,
                arg: 'maxBodySize'
            },
            'throttle': {
                'burst': {
                    doc: 'Throttle burst',
                    format: 'integer',
                    default: 100,
                    arg: 'throttle-burst'
                },
                'rate': {
                    doc: 'Throttle rate',
                    format: 'integer',
                    default: 50,
                    arg: 'throttle-rate'
                }
            }
        });

        if (optimist.argv.cfg) {
            Config.convictConf.loadFile(optimist.argv.cfg);
        }
        Config.convictConf.validate();

        // Build options object
        Config.initialize();
    })();

    private static initialize(): void {
        // Bunyan logger options
        // Override default bunyan response serializer
        bunyan.stdSerializers['res'] = function(res): any {
            if (!res || !res.statusCode) {
                return res;
            }
            return {
                statusCode: res.statusCode,
                header: res._headers
            };
        };
        // Add client cert serializer
        bunyan.stdSerializers['cert'] = function(cert): any {
            return cert && {
                CN: cert.subject.CN,
                fingerprint: cert.fingerprint
            };
        };
        var streams: {}[] = [{level: Config.convictConf.get('logging.logfileLevel'),
                              path: Config.convictConf.get('logging.logfile')}];
        if (Config.convictConf.get('logging.stdout')) {
            streams.push({
                level: Config.convictConf.get('logging.stdoutLevel'),
                stream: process.stdout
            });
        }
        Config.otherConf['loggerOptions'] = {
            name: Config.convictConf.get('service.name'),
            streams: streams,
            serializers: bunyan.stdSerializers
        };

        // Restify bodyParser plugin options
        Config.otherConf['bodyParserOptions']
            = { maxBodySize: Config.convictConf.get('maxBodySize') };

        // Restify throttle plugin options
        Config.otherConf['throttleOptions'] = {
            burst: Config.convictConf.get('throttle.burst'),
            rate: Config.convictConf.get('throttle.rate'),
            ip: true,
            overrides: {
                '127.0.0.1': {
                    rate: 0,
                    burst: 0
                }
            }
        };

        // HTTP(S) server options
        Config.otherConf['serverOptions'] = {
            name: Config.convictConf.get('service.name'),
            version: Config.convictConf.get('service.version'),
            acceptable: ['application/json']
        };
        if (Config.convictConf.get('https.enable')) {
            Config.otherConf['serverOptions'].httpsServerOptions = {
                key: fs.readFileSync(path.resolve(__dirname,
                    Config.convictConf.get('https.key'))),
                cert: fs.readFileSync(path.resolve(__dirname,
                    Config.convictConf.get('https.cert'))),
                ca: fs.readFileSync(path.resolve(__dirname,
                    Config.convictConf.get('https.ca'))),
                requestCert: true,
                rejectUnauthorized: true
            };
        }
    }

    public static get(name: string): any {
        if (name in Config.otherConf) {
            return Config.otherConf[name];
        }

        return Config.convictConf.get(name);
    }
}







