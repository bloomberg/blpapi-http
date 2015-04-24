#!/bin/bash

# usage: ./HistoricalEODStudyRequest.sh <request.json>

if [ "$#" -ne 1 ]; then
	echo "Missing Historical EOD Study Request JSON"
	exit 1
fi

REQUEST="$1"

curl -v -X POST "https://http-api-host/request?ns=blp&service=tasvc&type=studyRequest"  \
     --cacert bloomberg.crt \
     --cert   client.crt    \
     --key    client.key    \
     --data @"$REQUEST"
