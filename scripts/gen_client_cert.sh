#! /usr/bin/env bash

# WARNING: This script is only intended for development and testing purpose.
#          DO NOT USE IN PRODUCTION ENVIRONMENT
# usage: ./gen_client_cert.sh <path>

## INCLUDES ##
# shellcheck source=scripts/util.sh
source "$(dirname "$0")/util.sh"

## MAIN ##
main() {
    cmd_exist_or_error openssl

    if [ "$#" -ne 1 ]; then
        echo "must specify path"
        exit 1
    fi

    local -r dir="$1"

    # generate client cert
    gen_cert "$dir" client "/CN=BLPAPI_HTTP_TEST_CLIENT/"
}
main "$@"
