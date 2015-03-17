#!/usr/bin/env bash

# WARNING: This script is only intended for development and testing purpose.
#          DO NOT USE IN PRODUCTION ENVIRONMENT
# usage: ./gen_keys.sh [<path>]

## INCLUDES ##
source "$(dirname "$0")/util.sh"

## FUNCTIONS ##
gen_cert() {
    local -r dir="$1"
    local -r name="$2"
    local -r sub="$3"
    # generate private key
    openssl genrsa -out "$dir/$name-key.pem" 1024
    # generate csr
    openssl req -new -key "$dir/$name-key.pem" \
        -out "$dir/$name-csr.pem" -text -subj "$sub"
    # generate cert
    openssl x509 -req -in "$dir/$name-csr.pem" \
        -CA "$dir/ca-cert.pem" -CAkey "$dir/ca-key.pem" \
        -set_serial 01 -out "$dir/$name-cert.pem" -text
}

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
main
