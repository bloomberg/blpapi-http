#!/usr/bin/env bash

# WARNING: This script is only intended for development and testing purpose.
#          DO NOT USE IN PRODUCTION ENVIRONMENT
# usage: ./gen_keys.sh [<path>]

## INCLUDES ##
# shellcheck source=scripts/util.sh
source "$(dirname "$0")/util.sh"

## MAIN ##
main() {
    cmd_exist_or_error openssl

    # make directory if path provided
    local -r dir="${1:-${PWD}}"
    mkdir -p "$dir"

    # generate ca private key
    openssl genrsa -out "$dir/ca-key.pem" 1024
    # generate ca
    openssl req -new -x509 -text -key "$dir/ca-key.pem" \
        -out "${dir}/ca-cert.pem" -subj "/CN=BLPAPI_HTTP_TEST_CA/"

    # generate server cert
    gen_cert "$dir" server "/CN=localhost/"
    # generate client cert
    gen_cert "$dir" client "/CN=BLPAPI_HTTP_TEST_CLIENT/"
}
main "$@"
