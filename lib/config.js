var fs = require('fs');
var path = require('path');
var convict = require('convict');
var optimist = require('optimist');
var bunyan = require('bunyan');

// CONSTANTS
var CONFIG_FILE_NAME = 'blpapi-http.json';

// prefixes are in precedent order
// i.e., prefixes at the beginning of the list have higher precedence
var CONFIG_FILE_PREFIXES = [
    '.',
];

var config = module.exports = convict({
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
    }
});

if (optimist.argv.cfg)
    config.loadFile(optimist.argv.cfg);
config.validate();

// Bunyan logger options
// Override default bunyan response serializer
bunyan.stdSerializers.res = function(res) {
    if (!res || !res.statusCode) {
        return res;
    }
    return {
        statusCode: res.statusCode,
        header: res._headers
    };
};
module.exports.loggerOptions = {
    name: 'blpapi-http',
    streams: [
        {
          stream: process.stdout,
          level: 'info'
        },
        {
          // TODO: Rolling appender
          path: 'test.log',
          level: 'trace'
        }
    ],
    serializers: bunyan.stdSerializers
};

// Restify bodyParser plugin options
module.exports.bodyParserOptions = { maxBodySize: 1024 };

// Restify throttle plugin options
module.exports.throttleOptions = {
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
