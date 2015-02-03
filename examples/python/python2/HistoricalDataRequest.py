#!/usr/bin/env python2.7

"""
    HistoricalDataRequest.py - retrieve a set of historical data from the BLPAPI
    HTTP interface.

    For usage instructions, run
            ./HistoricalDataRequest.py -h
"""

import sys
if sys.version_info[:2] != (2, 7):
    print 'This example is only compatible with 2.7.x. Please install this ' \
          'version or modify the example to be compatible with your version.'
    sys.exit(1)

import httplib
import json
import pprint
try:
    import argparse
except ImportError as e:
    print 'This script requires argparse, available in 2.7.x.'
    sys.exit(1)
try:
    import ssl
except ImportError as e:
    print 'SSL is not configured for your Python package, which is necessary ' \
          'to run this code sample'
    sys.exit(1)


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
    try:
        conn.request('POST', '/request/blp/refdata/HistoricalData', json.dumps(data), headers)
        response = conn.getresponse()

        print response.status, response.reason
        pprint.pprint(json.loads(response.read()))
    except Exception as e:
        print e
        return 1
    return 0

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
