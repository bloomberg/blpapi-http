#!/bin/bash

# usage: ./FieldInfo.sh <request.json>

if [ "$#" -ne 1 ]; then
	echo "Missing Field Info JSON"
	exit 1
fi

REQUEST="$1"

curl -v -X POST "https://http-api.openbloomberg.com/request?ns=blp&service=apiflds&type=FieldInfoRequest"  \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @"$REQUEST"
