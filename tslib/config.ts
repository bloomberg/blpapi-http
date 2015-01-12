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
    private static _constructor = (() => {
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
            }
        });

        if (optimist.argv.cfg) {
            Config.convictConf.loadFile(optimist.argv.cfg);
        }
        Config.convictConf.validate();

        // Bunyan logger options
        // Override default bunyan response serializer
        bunyan.stdSerializers['res'] = function(res) {
            if (!res || !res.statusCode) {
                return res;
            }
            return {
                statusCode: res.statusCode,
                header: res._headers
            };
        };
        Config.otherConf['loggerOptions'] = {
            name: 'blpapi-http',
            streams: [
                {
                    stream: process.stdout,
                    level: 'info'
                },
                {
                    // TODO: Rolling appender
                    path: 'blpapi-http.log',
                    level: 'trace'
                }
            ],
            serializers: bunyan.stdSerializers
        };

        // Restify bodyParser plugin options
        Config.otherConf['bodyParserOptions'] = { maxBodySize: 1024 };

        // Restify throttle plugin options
        Config.otherConf['throttleOptions'] = {
            burst: 100,
            rate: 50,
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
            name: 'BLPAPI-HTTP',
            version: '1.0.0',
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

    })();

    public static get(name: string): any {
        if (name in Config.otherConf) {
            return Config.otherConf[name];
        }

        return Config.convictConf.get(name);
    }
}







