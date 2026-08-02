#!/bin/sh
# shellcheck disable=SC2154
valid_terminal_receipt() {
  candidate=$1
  [ -n "$candidate" ] && [ "$(printf '%s' "$candidate" | /usr/bin/jq -cS .)" = "$candidate" ] || return 1
  printf '%s' "$candidate" | /usr/bin/jq -e --arg capture "$capture_sha" 'keys == ["captureSha256","imageDigest","registrationReleaseSha256","runnerIdentitySha256","sealedRunnerSha256"] and .captureSha256 == $capture and (.imageDigest | test("^sha256:[a-f0-9]{64}$")) and (.registrationReleaseSha256,.runnerIdentitySha256,.sealedRunnerSha256 | test("^[a-f0-9]{64}$"))' >/dev/null
}
valid_retry_receipt() { candidate=$1; [ -n "$candidate" ] && [ "$(printf '%s' "$candidate" | /usr/bin/jq -cS .)" = "$candidate" ] || return 1; printf '%s' "$candidate" | /usr/bin/jq -e --arg capture "$capture_sha" 'keys == ["captureSha256","disposition","schemaVersion"] and .schemaVersion == 1 and .captureSha256 == $capture and .disposition == "retry-block"' >/dev/null; }
valid_deferred_terminal() { valid_terminal_receipt "$1" || valid_retry_receipt "$1"; }
