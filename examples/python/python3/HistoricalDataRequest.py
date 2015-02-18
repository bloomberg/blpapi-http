#!/usr/bin/env python3

# usage: python3 HistoricalDataRequest.py <host-ip>

import argparse
import json
import ssl
import sys
import urllib.request

data = {
    "securities": ["IBM US Equity", "AAPL US Equity"],
    "fields": ["PX_LAST", "OPEN", "EPS_ANNUALIZED"],
    "startDate": "20120101",
    "endDate": "20120301",
    "periodicitySelection": "DAILY"
}

def request(args):
    req = urllib.request.Request('https://{}/request?ns=blp&service=refdata&type=HistoricalDataRequest'.format(args.host))
    req.add_header('Content-Type', 'application/json')

    ctx = ssl.SSLContext(ssl.PROTOCOL_SSLv23)
    ctx.load_verify_locations('bloomberg.crt')
    ctx.load_cert_chain('client.crt', 'client.key')

    https_sslv23_handler = urllib.request.HTTPSHandler(context=ctx)
    opener = urllib.request.build_opener(https_sslv23_handler)
    urllib.request.install_opener(opener)

    try:
        res = opener.open(req, data=json.dumps(data).encode("ascii"))
        print(res.read())
    except Exception as e:
        e
        print(e)
        return 1
    return 0


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('host', type=str)
    return request(parser.parse_args())

if __name__ == "__main__":
    sys.exit(main())
