#!/bin/bash

# usage: [HOST=<ip>] ./HistoricalDataRequest.sh
# $ HOST=54.174.49.59 ./HistoricalDataRequest.sh

${HOST:="127.0.0.1"}
curl -v -X POST "https://$HOST/request/blp/refdata/HistoricalData"  \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @- <<EOF
{
    "securities": ["IBM US Equity", "AAPL US Equity"],
    "fields": ["PX_LAST", "OPEN", "EPS_ANNUALIZED"],
    "startDate": "20120101",
    "endDate": "20120301",
    "periodicitySelection": "DAILY" 
}
EOF
