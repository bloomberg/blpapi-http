#!/bin/bash

set -e

HOST="http://localhost:3000"
echo "Connecting..."
curl -X POST $HOST/connect --data '{ "x" : 1 }'

curl -X POST $HOST/request/HistoricalDataRequest --data @- <<EOF
{ "securities": ["IBM US Equity"],
            "fields": ["PX_LAST", "OPEN", "EPS_ANNUALIZED"],
            "startDate": "20120101",
            "endDate": "20120301",
            "periodicitySelection": "DAILY" }
EOF
