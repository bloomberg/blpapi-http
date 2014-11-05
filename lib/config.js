var fs = require('fs');
var path = require('path');

var convict = require('convict');

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
    }
}).loadFile(CONFIG_FILE_PREFIXES.map(function(prefix) {
    return path.normalize(path.join(prefix, CONFIG_FILE_NAME));
}).filter(function(path) {
    return fs.existsSync(path);
}).reverse()).validate();
