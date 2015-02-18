#!/bin/bash

# usage: ./ReferenceData.sh <request.json>

if [ "$#" -ne 1 ]; then
	echo "Missing Reference Data JSON"
	exit 1
fi

REQUEST="$1"
curl -v -X POST "https://http-api.openbloomberg.com/request?ns=blp&service=refdata&type=ReferenceDataRequest"  \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @"$REQUEST"
