#!/usr/bin/env bash
set -euo pipefail

AVD_NAME="${BACI_ANDROID_AVD_NAME:-Medium_Phone_API_36.1}"
GPU_MODE="${BACI_ANDROID_GPU_MODE:-auto}"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR="${SDK_ROOT}/emulator/emulator"
LOG_FILE="${BACI_ANDROID_EMULATOR_LOG:-/tmp/baci-mobile-admin-emulator.log}"
BOOT_TIMEOUT_SECONDS="${BACI_ANDROID_BOOT_TIMEOUT_SECONDS:-180}"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-5554}"
MIN_EMULATOR_BUILD="${BACI_ANDROID_MIN_EMULATOR_BUILD:-15261927}"
ADB_STABILITY_PROBES="${BACI_ANDROID_ADB_STABILITY_PROBES:-3}"
cleanup_files=()

cleanup() {
  if ((${#cleanup_files[@]} > 0)); then
    rm -f "${cleanup_files[@]}" 2>/dev/null || true
  fi
}

track_temp_file() {
  cleanup_files+=("$1")
}

untrack_temp_file() {
  local target="$1"
  local remaining=()
  local file

  for file in "${cleanup_files[@]}"; do
    if [[ "$file" != "$target" ]]; then
      remaining+=("$file")
    fi
  done

  cleanup_files=("${remaining[@]}")
}

remove_temp_file() {
  local target="$1"
  rm -f "$target"
  untrack_temp_file "$target"
}

trap cleanup EXIT
trap 'cleanup; exit 130' INT
trap 'cleanup; exit 143' TERM

if [[ ! -x "$ADB" ]]; then
  echo "Android adb not found at $ADB" >&2
  exit 1
fi

if [[ ! -x "$EMULATOR" ]]; then
  echo "Android emulator not found at $EMULATOR" >&2
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required to launch the Android emulator detached from this shell." >&2
  exit 1
fi

if [[ "$GPU_MODE" == "swiftshader_indirect" ]]; then
  echo "Refusing -gpu swiftshader_indirect for mobile-admin QA; use auto or host." >&2
  exit 1
fi

emulator_version_output="$("$EMULATOR" -version 2>/dev/null | head -1)"
emulator_build="$(
  sed -n 's/.*build_id \([0-9][0-9]*\).*/\1/p' <<<"$emulator_version_output"
)"

if [[ -z "$emulator_build" || "$emulator_build" -lt "$MIN_EMULATOR_BUILD" ]]; then
  echo "Android Emulator is too old for mobile-admin QA: ${emulator_version_output:-unknown}." >&2
  echo "Install a current emulator package with:" >&2
  echo "  ${SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager --sdk_root=${SDK_ROOT} \"emulator\"" >&2
  exit 1
fi

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

capture_with_timeout() {
  local timeout_seconds="$1"
  local output_file="$2"
  shift 2

  run_with_timeout "$timeout_seconds" "$@" >"$output_file" 2>&1
}

wait_for_adb_shell() {
  local deadline=$((SECONDS + BOOT_TIMEOUT_SECONDS))
  local boot_output
  local probe_output

  while (( SECONDS < deadline )); do
    boot_output="$(mktemp)"
    track_temp_file "$boot_output"
    if capture_with_timeout 5 "$boot_output" "$ADB" -s "$ADB_SERIAL" shell getprop sys.boot_completed; then
      if [[ "$(tr -d '\r\n ' < "$boot_output")" == "1" ]]; then
        probe_output="$(mktemp)"
        track_temp_file "$probe_output"
        if capture_with_timeout 5 "$probe_output" "$ADB" -s "$ADB_SERIAL" shell echo ok; then
          if [[ "$(tr -d '\r\n ' < "$probe_output")" == "ok" ]]; then
            remove_temp_file "$boot_output"
            remove_temp_file "$probe_output"
            return 0
          fi
        fi
        remove_temp_file "$probe_output"
      fi
    fi
    remove_temp_file "$boot_output"
    sleep 3
  done

  return 1
}

confirm_adb_shell_stable() {
  local probe
  local probe_output

  for ((probe = 1; probe <= ADB_STABILITY_PROBES; probe++)); do
    probe_output="$(mktemp)"
    track_temp_file "$probe_output"
    if ! capture_with_timeout 5 "$probe_output" "$ADB" -s "$ADB_SERIAL" shell echo ok; then
      remove_temp_file "$probe_output"
      return 1
    fi

    if [[ "$(tr -d '\r\n ' < "$probe_output")" != "ok" ]]; then
      remove_temp_file "$probe_output"
      return 1
    fi

    remove_temp_file "$probe_output"
    sleep 2
  done

  return 0
}

echo "Starting Android emulator for mobile-admin QA"
echo "AVD: $AVD_NAME"
echo "GPU: $GPU_MODE"
echo "Emulator: $emulator_version_output"
echo "Log: $LOG_FILE"

"$ADB" kill-server >/dev/null 2>&1 || true
"$ADB" start-server >/dev/null

if "$ADB" devices | grep -q "^${ADB_SERIAL}[[:space:]]"; then
  "$ADB" -s "$ADB_SERIAL" emu kill >/dev/null 2>&1 || true
  sleep 3
fi

rm -f "$LOG_FILE"
emulator_pid="$(
  python3 - "$EMULATOR" "$AVD_NAME" "$GPU_MODE" "$LOG_FILE" <<'PY'
import subprocess
import sys

emulator, avd_name, gpu_mode, log_file = sys.argv[1:]
log = open(log_file, 'ab', buffering=0)
process = subprocess.Popen(
    [
        emulator,
        f'@{avd_name}',
        '-gpu',
        gpu_mode,
        '-no-snapshot',
        '-no-boot-anim',
        '-no-audio',
        '-netdelay',
        'none',
        '-netspeed',
        'full',
        '-memory',
        '4096',
        '-cores',
        '4',
    ],
    stdin=subprocess.DEVNULL,
    stdout=log,
    stderr=subprocess.STDOUT,
    start_new_session=True,
    close_fds=True,
)
print(process.pid)
PY
)"
echo "Emulator PID: $emulator_pid"

if ! wait_for_adb_shell; then
  echo "Emulator did not reach a responsive adb shell within ${BOOT_TIMEOUT_SECONDS}s." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  kill "$emulator_pid" >/dev/null 2>&1 || true
  exit 1
fi

if ! confirm_adb_shell_stable; then
  echo "Emulator booted, but adb shell did not stay responsive." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  kill "$emulator_pid" >/dev/null 2>&1 || true
  exit 1
fi

echo "Android emulator ready on $ADB_SERIAL."
echo "Use this emulator for QA; do not relaunch it with -gpu swiftshader_indirect."
