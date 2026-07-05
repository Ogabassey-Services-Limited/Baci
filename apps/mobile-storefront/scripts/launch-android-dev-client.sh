#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/lib/timeout.sh"
source "${SCRIPT_DIR}/lib/android-common.sh"

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$(default_sdk_root)}}"
ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR_PORT="${BACI_ANDROID_EMULATOR_PORT:-5554}"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}}"
APP_ID="${BACI_ANDROID_APP_ID:-com.ogabassey.store}"
SCHEME="${BACI_ANDROID_SCHEME:-ogabassey}"
METRO_PORT="${BACI_ANDROID_METRO_PORT:-8082}"
DEV_SERVER_URL="${BACI_ANDROID_DEV_SERVER_URL:-http://10.0.2.2:${METRO_PORT}}"
SHELL_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_SHELL_TIMEOUT_SECONDS:-120}"
SETTLE_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_SETTLE_TIMEOUT_SECONDS:-300}"
SETTLE_LOAD_MAX="${BACI_ANDROID_LAUNCH_LOAD_MAX:-8.0}"
SETTLE_STABILITY_PROBES="${BACI_ANDROID_LAUNCH_SETTLE_STABILITY_PROBES:-2}"
PID_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_PID_TIMEOUT_SECONDS:-45}"
AM_START_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_AM_START_TIMEOUT_SECONDS:-20}"
REVERSE_TIMEOUT_SECONDS="${BACI_ANDROID_LAUNCH_REVERSE_TIMEOUT_SECONDS:-20}"
FORCE_STOP="${BACI_ANDROID_FORCE_STOP:-1}"
register_temp_file_cleanup_traps

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

ensure_metro_reverse() {
  if ! run_with_timeout "$REVERSE_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null; then
    echo "Failed to register adb reverse for Metro port ${METRO_PORT}." >&2
    exit 1
  fi
  if ! run_with_timeout "$REVERSE_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" reverse --list | grep -Fq "tcp:${METRO_PORT} tcp:${METRO_PORT}"; then
    echo "Failed to register adb reverse for Metro port ${METRO_PORT}." >&2
    exit 1
  fi
}

wait_for_app_pid() {
  local deadline=$((SECONDS + PID_TIMEOUT_SECONDS))
  local app_pid

  while (( SECONDS < deadline )); do
    app_pid="$(run_with_timeout 5 "$ADB" -s "$ADB_SERIAL" shell pidof -s "$APP_ID" 2>/dev/null | tr -d '\r\n ' || true)"
    if [[ -n "$app_pid" ]]; then
      echo "Launched ${APP_ID} with pid ${app_pid}."
      return 0
    fi
    sleep 2
  done

  return 1
}

echo "Launching mobile-storefront Android dev client"
echo "Device: $ADB_SERIAL"
echo "Package: $APP_ID"
echo "Metro: $DEV_SERVER_URL"

if ! wait_for_adb_shell_ready "$SHELL_TIMEOUT_SECONDS"; then
  echo "No responsive Android shell on ${ADB_SERIAL}. Start with: pnpm --filter @baci/mobile-storefront android:emulator" >&2
  exit 1
fi

if ! wait_for_android_load_settle "$SETTLE_TIMEOUT_SECONDS" "$SETTLE_LOAD_MAX" "$SETTLE_STABILITY_PROBES"; then
  echo "Android did not settle below load ${SETTLE_LOAD_MAX} within ${SETTLE_TIMEOUT_SECONDS}s." >&2
  exit 1
fi

ensure_metro_reverse

if [[ "$FORCE_STOP" == "1" ]]; then
  run_with_timeout "$AM_START_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" shell am force-stop "$APP_ID" >/dev/null 2>&1 || true
fi

run_with_timeout "$AM_START_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" shell am start -a android.intent.action.VIEW -d "$DEV_CLIENT_URL" "$APP_ID" >/dev/null

if ! wait_for_app_pid; then
  echo "Launch command completed, but ${APP_ID} did not report a pid within ${PID_TIMEOUT_SECONDS}s." >&2
  exit 1
fi

echo "Android dev client ready. Use this path instead of raw adb launch commands."
