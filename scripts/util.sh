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
