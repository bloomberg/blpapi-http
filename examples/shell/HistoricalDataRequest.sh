#!/bin/bash

# usage: ./HistoricalDataRequest.sh <request.json>

if [ "$#" -ne 1 ]; then
	echo "Missing Historical Data Request JSON"
	exit 1
fi

REQUEST="$1"

curl -v -X POST "https://http-api-host/request?ns=blp&service=refdata&type=HistoricalDataRequest"  \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @"$REQUEST"
