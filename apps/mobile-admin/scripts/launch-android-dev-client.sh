#!/usr/bin/env bash
set -euo pipefail

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
ADB="${SDK_ROOT}/platform-tools/adb"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-5554}"
APP_ID="${BACI_ANDROID_APP_ID:-com.ogabassey.baci}"
SCHEME="${BACI_ANDROID_SCHEME:-baciadmin}"
METRO_PORT="${BACI_ANDROID_METRO_PORT:-8081}"
DEV_SERVER_URL="${BACI_ANDROID_DEV_SERVER_URL:-http://10.0.2.2:${METRO_PORT}}"
SHELL_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_SHELL_TIMEOUT_SECONDS:-120}"
SETTLE_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_SETTLE_TIMEOUT_SECONDS:-300}"
SETTLE_LOAD_MAX="${BACI_ANDROID_LAUNCH_LOAD_MAX:-8.0}"
SETTLE_STABILITY_PROBES="${BACI_ANDROID_LAUNCH_SETTLE_STABILITY_PROBES:-2}"
PID_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_PID_TIMEOUT_SECONDS:-45}"
AM_START_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_AM_START_TIMEOUT_SECONDS:-20}"
FORCE_STOP="${BACI_ANDROID_FORCE_STOP:-1}"

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="${SDK_ROOT}/platform-tools:${SDK_ROOT}/cmdline-tools/latest/bin:${PATH}"

if [[ ! -x "$ADB" ]]; then
  echo "Android adb not found at $ADB" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to build the Expo dev-client launch URL." >&2
  exit 1
fi

if [[ "$FORCE_STOP" != "0" && "$FORCE_STOP" != "1" ]]; then
  echo "BACI_ANDROID_FORCE_STOP must be 0 or 1." >&2
  exit 1
fi

encoded_dev_server_url="$(
  python3 - "$DEV_SERVER_URL" <<'PY'
import sys
from urllib.parse import quote

print(quote(sys.argv[1], safe=""))
PY
)"
DEV_CLIENT_URL="${SCHEME}://expo-development-client/?url=${encoded_dev_server_url}"

run_with_timeout() {
  local timeout_seconds="$1"
  shift

  "$@" &
  local command_pid="$!"
  local elapsed=0

  while kill -0 "$command_pid" 2>/dev/null; do
    if (( elapsed >= timeout_seconds )); then
      kill "$command_pid" 2>/dev/null || true
      wait "$command_pid" 2>/dev/null || true
      return 124
    fi

    sleep 1
    elapsed=$((elapsed + 1))
  done

  wait "$command_pid"
}

wait_for_adb_shell() {
  local deadline=$((SECONDS + SHELL_TIMEOUT_SECONDS))
  local boot_completed
  local probe

  while (( SECONDS < deadline )); do
    boot_completed="$("$ADB" -s "$ADB_SERIAL" shell getprop sys.boot_completed 2>/dev/null | tr -d '\r\n ' || true)"
    probe="$("$ADB" -s "$ADB_SERIAL" shell echo ok 2>/dev/null | tr -d '\r\n ' || true)"
    if [[ "$boot_completed" == "1" && "$probe" == "ok" ]]; then
      return 0
    fi
    sleep 3
  done

  return 1
}

wait_for_android_settle() {
  local deadline=$((SECONDS + SETTLE_TIMEOUT_SECONDS))
  local load_one
  local stable_probe_count=0

  while (( SECONDS < deadline )); do
    load_one="$("$ADB" -s "$ADB_SERIAL" shell cat /proc/loadavg 2>/dev/null | awk '{print $1}' || true)"
    if [[ -n "$load_one" ]] && awk -v load="$load_one" -v max="$SETTLE_LOAD_MAX" 'BEGIN { exit !(load <= max) }'; then
      stable_probe_count=$((stable_probe_count + 1))
      if (( stable_probe_count >= SETTLE_STABILITY_PROBES )); then
        return 0
      fi
    else
      stable_probe_count=0
    fi

    echo "Android load average: ${load_one:-unknown} (target <= $SETTLE_LOAD_MAX)"
    sleep 5
  done

  return 1
}

ensure_metro_reverse() {
  "$ADB" -s "$ADB_SERIAL" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null
  if ! "$ADB" -s "$ADB_SERIAL" reverse --list | grep -Fq "tcp:${METRO_PORT} tcp:${METRO_PORT}"; then
    echo "Failed to register adb reverse for Metro port ${METRO_PORT}." >&2
    exit 1
  fi
}

wait_for_app_pid() {
  local deadline=$((SECONDS + PID_TIMEOUT_SECONDS))
  local app_pid

  while (( SECONDS < deadline )); do
    app_pid="$("$ADB" -s "$ADB_SERIAL" shell pidof -s "$APP_ID" 2>/dev/null | tr -d '\r\n ' || true)"
    if [[ -n "$app_pid" ]]; then
      echo "Launched ${APP_ID} with pid ${app_pid}."
      return 0
    fi
    sleep 2
  done

  return 1
}

echo "Launching mobile-admin Android dev client"
echo "Device: $ADB_SERIAL"
echo "Package: $APP_ID"
echo "Metro: $DEV_SERVER_URL"

if ! wait_for_adb_shell; then
  echo "No responsive Android shell on ${ADB_SERIAL}. Start with: pnpm --filter baci-mobile-admin android:emulator" >&2
  exit 1
fi

if ! wait_for_android_settle; then
  echo "Android did not settle below load ${SETTLE_LOAD_MAX} within ${SETTLE_TIMEOUT_SECONDS}s." >&2
  exit 1
fi

ensure_metro_reverse

if [[ "$FORCE_STOP" == "1" ]]; then
  "$ADB" -s "$ADB_SERIAL" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
fi

run_with_timeout "$AM_START_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_CLIENT_URL" "$APP_ID" >/dev/null

if ! wait_for_app_pid; then
  echo "Launch command completed, but ${APP_ID} did not report a pid within ${PID_TIMEOUT_SECONDS}s." >&2
  exit 1
fi

echo "Android dev client ready. Use this path instead of raw adb launch commands."
