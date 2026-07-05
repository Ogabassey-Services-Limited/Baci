#!/usr/bin/env bash

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  if command -v timeout >/dev/null 2>&1 && timeout --help 2>/dev/null | grep -q -- '--kill-after'; then
    timeout --kill-after=2s "$timeout_seconds" "$@"
    local status=$?
    if ((status == 124 || status == 137)); then
      return 124
    fi
    return "$status"
  fi

  python3 - "$timeout_seconds" "$@" <<'PY'
import os
import signal
import subprocess
import sys

timeout_seconds = float(sys.argv[1])
command = sys.argv[2:]

process = subprocess.Popen(command, start_new_session=True)

try:
    sys.exit(process.wait(timeout=timeout_seconds))
except subprocess.TimeoutExpired:
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        pass

    try:
        process.wait(timeout=2)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(process.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        process.wait()
    sys.exit(124)
PY
}

capture_with_timeout() {
  local timeout_seconds="$1"
  local output_file="$2"
  shift 2

  run_with_timeout "$timeout_seconds" "$@" >"$output_file" 2>&1
}
