#!/bin/bash

# usage: ./GovernmentLookup.sh <request.json>

if [ "$#" -ne 1 ]; then
	echo "Missing Government Lookup JSON"
	exit 1
fi

REQUEST="$1"

curl -v -X POST "https://http-api.openbloomberg.com/request/blp/instruments/govtListRequest"  \
     --cacert bloomberg.crt \
     --cert   client.crt    \
     --key    client.key    \
     --data @"$REQUEST"
