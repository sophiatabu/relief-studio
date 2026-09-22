#!/bin/zsh
cd "$(dirname "$0")/dist" || exit 1
/usr/bin/python3 -m http.server 5175 --bind 127.0.0.1 &
relief_server_pid=$!
trap 'kill "$relief_server_pid" 2>/dev/null' EXIT INT TERM
open 'http://127.0.0.1:5175/'
wait "$relief_server_pid"
