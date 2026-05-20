#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

default_sdk_root() {
  case "$(uname -s)" in
    Darwin)
      printf '%s\n' "$HOME/Library/Android/sdk"
      ;;
    Linux)
      printf '%s\n' "$HOME/Android/Sdk"
      ;;
    MINGW* | MSYS* | CYGWIN*)
      if [[ -n "${LOCALAPPDATA:-}" ]]; then
        printf '%s\n' "${LOCALAPPDATA}\\Android\\Sdk"
      fi
      ;;
  esac
}

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$(default_sdk_root)}}"
ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR_PORT="${BACI_ANDROID_EMULATOR_PORT:-5554}"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}}"
APK_PATH="${BACI_ANDROID_APK_PATH:-android/app/build/outputs/apk/debug/app-debug.apk}"
ADB_WAIT_TIMEOUT_SECONDS="${BACI_ANDROID_ADB_WAIT_TIMEOUT_SECONDS:-60}"
ADB_SHELL_TIMEOUT_SECONDS="${BACI_ANDROID_ADB_SHELL_TIMEOUT_SECONDS:-20}"

run_adb_shell_with_timeout() {
  local timeout_seconds="$1"
  shift

  local output_file
  local exit_file
  output_file="$(mktemp "${TMPDIR:-/tmp}/baci-adb-shell.XXXXXX")"
  exit_file="$(mktemp "${TMPDIR:-/tmp}/baci-adb-shell-exit.XXXXXX")"

  (
    set +e
    "$ADB" -s "$ADB_SERIAL" shell "$@" >"$output_file" 2>/dev/null
    printf '%s\n' "$?" >"$exit_file"
  ) &
  local shell_pid=$!
  local deadline=$((SECONDS + timeout_seconds))

  while kill -0 "$shell_pid" 2>/dev/null; do
    if ((SECONDS >= deadline)); then
      kill "$shell_pid" 2>/dev/null || true
      wait "$shell_pid" 2>/dev/null || true
      rm -f "$output_file" "$exit_file"
      return 124
    fi
    sleep 1
  done

  wait "$shell_pid" 2>/dev/null || true

  local exit_status=1
  if [[ -f "$exit_file" ]]; then
    exit_status="$(tr -d '\r\n ' <"$exit_file")"
  fi
  if ! [[ "$exit_status" =~ ^[0-9]+$ ]]; then
    exit_status=1
  fi

  cat "$output_file"
  rm -f "$output_file" "$exit_file"
  return "${exit_status:-1}"
}

if [[ ! -x "$ADB" ]]; then
  echo "Android adb not found. Set ANDROID_SDK_ROOT or ANDROID_HOME, or install the Android SDK at $SDK_ROOT." >&2
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
  adb_state="$("$ADB" -s "$ADB_SERIAL" get-state 2>/dev/null | tr -d '\r\n ' || true)"
  boot_completed=""

  if [[ "$adb_state" == "device" ]]; then
    boot_completed="$(run_adb_shell_with_timeout "$ADB_SHELL_TIMEOUT_SECONDS" getprop sys.boot_completed | tr -d '\r\n ' || true)"
  fi

  if [[ "$adb_state" == "device" && "$boot_completed" == "1" ]]; then
    break
  fi

  if ((SECONDS >= deadline)); then
    echo "Android device $ADB_SERIAL did not become ready and boot-complete within ${ADB_WAIT_TIMEOUT_SECONDS}s." >&2
    echo "Start it first with: pnpm --filter baci-mobile-admin android:emulator" >&2
    exit 1
  fi

  sleep 2
done

shell_probe="$(run_adb_shell_with_timeout "$ADB_SHELL_TIMEOUT_SECONDS" echo ok | tr -d '\r\n ' || true)"
if [[ "$shell_probe" != "ok" ]]; then
  echo "Android adb shell is not responsive on $ADB_SERIAL." >&2
  exit 1
fi

"$ADB" -s "$ADB_SERIAL" install -r -d -t --no-streaming "$APK_PATH"

echo "Android debug APK installed on $ADB_SERIAL."
