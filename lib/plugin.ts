import tls = require('tls');
import apiSession = require('./api-session');
import conf = require('./config');

export = Plugin;

class Plugin {

    // Custom logging plugin.
    // Log client cert details, request body, etc
    public static log(): (req: apiSession.OurRequest,
                          res: apiSession.OurResponse,
                          next: Function ) => void {

        return function log(req: apiSession.OurRequest,
                            res: apiSession.OurResponse,
                            next: Function ): void {
            // Log client certificate details(only in https mode)
            if (conf.get('https.enable') && conf.get('logging.clientDetail')) {
                // Note: The doulbe casting is needed because union type is not available in ts 1.3
                // TODO: Switch req.connection type definition to net.Socket|tls.ClearTextStream
                // TODO: when ts 1.4.0 is officially released
                req.log.debug(
                  {cert: (<tls.ClearTextStream><any>req.connection).getPeerCertificate()});
            }

            // Log request body
            if (conf.get('logging.reqBody')) {
                req.log.debug({body: req.body});
            }

            return next();
        };
    }
}
