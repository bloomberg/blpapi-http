#!/usr/bin/env bash

## FUNCTIONS ##
fatal() {
    echo 1>&2 "$@"
    exit 1
}

cmd_exist_or_error() {
    local -r cmd="$1"

    if ! command -v "$cmd" > /dev/null; then
        fatal "$cmd not found"
    fi
}

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
