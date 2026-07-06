#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

source "${SCRIPT_DIR}/lib/timeout.sh"
source "${SCRIPT_DIR}/lib/android-common.sh"

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$(default_sdk_root)}}"
ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR_PORT="${BACI_ANDROID_EMULATOR_PORT:-5554}"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}}"
APK_PATH="${BACI_ANDROID_APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk}"
ADB_WAIT_TIMEOUT_SECONDS="${BACI_ANDROID_ADB_WAIT_TIMEOUT_SECONDS:-60}"
ADB_SHELL_TIMEOUT_SECONDS="${BACI_ANDROID_ADB_SHELL_TIMEOUT_SECONDS:-20}"
ADB_INSTALL_TIMEOUT_SECONDS="${BACI_ANDROID_ADB_INSTALL_TIMEOUT_SECONDS:-120}"

run_adb_shell_with_timeout() {
  local timeout_seconds="$1"
  shift

  run_with_timeout "$timeout_seconds" "$ADB" -s "$ADB_SERIAL" shell "$@" 2>/dev/null
}

if [[ ! -x "$ADB" ]]; then
  echo "Android adb not found. Set ANDROID_SDK_ROOT or ANDROID_HOME, or install the Android SDK at $SDK_ROOT." >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to run bounded Android adb operations." >&2
  exit 1
fi

if ! [[ "$ADB_WAIT_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || ((ADB_WAIT_TIMEOUT_SECONDS <= 0)); then
  echo "BACI_ANDROID_ADB_WAIT_TIMEOUT_SECONDS must be a positive integer." >&2
  exit 1
fi

if ! [[ "$ADB_SHELL_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || ((ADB_SHELL_TIMEOUT_SECONDS <= 0)); then
  echo "BACI_ANDROID_ADB_SHELL_TIMEOUT_SECONDS must be a positive integer." >&2
  exit 1
fi

if ! [[ "$ADB_INSTALL_TIMEOUT_SECONDS" =~ ^[0-9]+$ ]] || ((ADB_INSTALL_TIMEOUT_SECONDS <= 0)); then
  echo "BACI_ANDROID_ADB_INSTALL_TIMEOUT_SECONDS must be a positive integer." >&2
  exit 1
fi

if [[ "$APK_PATH" != /* ]]; then
  APK_PATH="${APP_ROOT}/${APK_PATH}"
fi

if [[ ! -f "$APK_PATH" ]]; then
  echo "Android debug APK not found at $APK_PATH" >&2
  echo "Build it first with:" >&2
  echo "  cd \"${APP_ROOT}/android\" && ./gradlew :app:assembleDebug -PreactNativeArchitectures=arm64-v8a --console=plain" >&2
  exit 1
fi

deadline=$((SECONDS + ADB_WAIT_TIMEOUT_SECONDS))
while true; do
  adb_state="$(run_with_timeout "$ADB_SHELL_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" get-state 2>/dev/null | tr -d '\r\n ' || true)"
  boot_completed=""

  if [[ "$adb_state" == "device" ]]; then
    boot_completed="$(run_adb_shell_with_timeout "$ADB_SHELL_TIMEOUT_SECONDS" getprop sys.boot_completed | tr -d '\r\n ' || true)"
  fi

  if [[ "$adb_state" == "device" && "$boot_completed" == "1" ]]; then
    break
  fi

  if ((SECONDS >= deadline)); then
    echo "Android device $ADB_SERIAL did not become ready and boot-complete within ${ADB_WAIT_TIMEOUT_SECONDS}s." >&2
    echo "Start it first with: pnpm --filter @baci/mobile-storefront android:emulator" >&2
    exit 1
  fi

  sleep 2
done

shell_probe="$(run_adb_shell_with_timeout "$ADB_SHELL_TIMEOUT_SECONDS" echo ok | tr -d '\r\n ' || true)"
if [[ "$shell_probe" != "ok" ]]; then
  echo "Android adb shell is not responsive on $ADB_SERIAL." >&2
  exit 1
fi

set +e
run_with_timeout "$ADB_INSTALL_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" install -r -d -t --no-streaming "$APK_PATH"
install_status=$?
set -e

if ((install_status != 0)); then
  if ((install_status == 124)); then
    echo "Android debug APK install timed out after ${ADB_INSTALL_TIMEOUT_SECONDS}s on $ADB_SERIAL." >&2
  else
    echo "Android debug APK install failed on $ADB_SERIAL." >&2
  fi
  exit "$install_status"
fi

echo "Android debug APK installed on $ADB_SERIAL."
