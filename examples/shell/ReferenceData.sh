#!/bin/bash

# usage: ./ReferenceData.sh <request.json>

# NOTE: This example program currently fails on Mac OSX 10.9 or later, due to the inability
# of 'curl' supplied in OSX to accept certificates and keys through command-line arguments.
# A workaround is to use an alternate build of 'curl' (from Homebrew or MacPorts).

if [ "$#" -ne 1 ]; then
	echo "Missing Reference Data JSON"
	exit 1
fi

REQUEST="$1"
curl -v -X POST "https://http-api.openbloomberg.com/request/blp/refdata/ReferenceData"  \
    --cacert bloomberg.crt \
    --cert   client.crt    \
    --key    client.key    \
    --data @"$REQUEST"
