#! /usr/bin/env bash

# WARNING: This script is only intended for development and testing purpose.
#          DO NOT USE IN PRODUCTION ENVIRONMENT
# usage: ./GenKey.sh [<path>]

# check if openssl exist
if command -v openssl >/dev/null; then
    echo $(openssl version)
else
    echo "openssl does not exist"
    exit 1
fi

gen_cert() {
    if [ "$#" -ne 3 ]; then
        echo "Missing parameter"
        exit 1
    fi

    DIR="$1"
    NAME="$2"
    SUB="$3"
    # generate private key
    openssl genrsa -out "$DIR"/"$NAME"-key.pem 1024
    # generate csr
    openssl req -new -key "$DIR"/"$NAME"-key.pem \
        -out "$DIR"/"$NAME"-csr.pem -text -subj "$SUB"
    # generate cert
    openssl x509 -req -in "$DIR"/"$NAME"-csr.pem \
        -CA "$DIR"/ca-cert.pem -CAkey "$DIR"/ca-key.pem \
        -set_serial 01 -out "$DIR"/"$NAME"-cert.pem -text
}

# make directory for certs and keys, if receive path argument
DIR=${1:-${PWD}}
if [ "$#" -eq 1 ]; then
    mkdir -p "$DIR"
fi

# generate ca private key
openssl genrsa -out "$DIR"/ca-key.pem 1024
# generate ca
openssl req -new -x509 -text -key "$DIR"/ca-key.pem \
    -out "$DIR"/ca-cert.pem -subj "/CN=BLPAPI_HTTP_TEST_CA/"

# generate server cert
gen_cert "$DIR" server "/CN=localhost/"
# generate client cert
gen_cert "$DIR" client "/CN=BLPAPI_HTTP_TEST_CLIENT/"