var nomnom = require('nomnom');

exports.parse = function() {
    return nomnom
        .option('host', {
            abbr: 'i',
            help: 'The Bloomberg API HTTP server hostname',
            metavar: '<host>',
            required: true
        })
        .option('port', {
            abbr: 'p',
            help: 'The Bloomberg API HTTP server port',
            metavar: '<port>',
            required: true
        })
        .parse();
}
