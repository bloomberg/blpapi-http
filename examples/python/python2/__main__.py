#!/usr/bin/env python2

import argparse
import json
import sys
import httplib
import pprint


data = {
    "securities": ["IBM US Equity", "AAPL US Equity"],
    "fields": ["PX_LAST", "OPEN", "EPS_ANNUALIZED"],
    "startDate": "20120101",
    "endDate": "20120301",
    "periodicitySelection": "DAILY"
}

def request(args):
    print args.host
    print args.key
    print args.cert
    conn = httplib.HTTPSConnection(args.host,
                                   key_file=args.key,
                                   cert_file=args.cert)
    headers = {'Content-Type': 'application/json'}
    conn.set_debuglevel(4)
    conn.request('POST', '/request/blp/refdata/HistoricalData', json.dumps(data), headers)
    response = conn.getresponse()

    print response.status, response.reason
    pprint.pprint(json.loads(response.read()))

def parse_args():
    parser = argparse.ArgumentParser(description='Makes a historical data ' \
                                     'request to the bloomberg http API for ' \
                                     'the tickers IBM and AAPL.', add_help=True)
    parser.add_argument('-k', '--key', action='store', type=str, dest='key',
                        metavar='KEYFILE', required=False, default='client.key',
                        help='The file containing the client key. Defaults to client.key')
    parser.add_argument('-c', '--cert', action='store', type=str, dest='cert',
                        metavar='CAFILE', required=False, default='client.crt',
                        help='The file containing the client cert. Defaults to client.crt')
    parser.add_argument('-s', '--host', action='store', type=str, dest='host',
                        metavar='HOSTURL', required=False, default='http-api.openbloomberg.com',
                        help='The base URL of the host. Defaults to http-api.openbloomberg.com.')
    return parser.parse_args()

def main():
    return request(parse_args())

if __name__ == "__main__":
    sys.exit(main())
