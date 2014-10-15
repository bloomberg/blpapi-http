#!/bin/bash

set -e

HOST="http://localhost:3000"
OPTS="--cookie cookies.txt --cookie-jar cookies.txt"
echo "Connecting..."
conn=$(curl $OPTS -X POST $HOST/v1.0/connect)
echo $conn
sessid=$(echo $conn | node prsess.js)
echo "SESSION ID $sessid"

curl $OPTS -X POST $HOST/v1.0/request/blp/refdata/HistoricalData?sessid=$sessid --data @- <<EOF
{ "securities": ["IBM US Equity", "AAPL US Equity"],
            "fields": ["PX_LAST", "OPEN", "EPS_ANNUALIZED"],
            "startDate": "20120101",
            "endDate": "20120301",
            "periodicitySelection": "DAILY" }
EOF

echo ""
echo ""

curl $OPTS -X POST $HOST/v1.0/request/blp/refdata/HistoricalData?sessid=$sessid --data @- <<EOF
{ "securities": ["AAPL US Equity"],
            "fields": ["PX_LAST", "OPEN"],
            "startDate": "20120101",
            "endDate": "20120301",
            "periodicitySelection": "DAILY" }
EOF
