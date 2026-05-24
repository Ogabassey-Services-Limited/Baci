#!/usr/bin/env bash
set -euo pipefail

AVD_NAME="${BACI_ANDROID_AVD_NAME:-Baci_Pixel_9_Pro_XL_API_36_Google}"
ANDROID_PLATFORM_PACKAGE="${BACI_ANDROID_PLATFORM_PACKAGE:-platforms;android-36}"
ANDROID_SYSTEM_IMAGE_PACKAGE="${BACI_ANDROID_SYSTEM_IMAGE_PACKAGE:-system-images;android-36;google_apis;arm64-v8a}"
ANDROID_DEVICE_PROFILE="${BACI_ANDROID_DEVICE_PROFILE:-pixel_9_pro_xl}"
GPU_MODE="${BACI_ANDROID_GPU_MODE:-auto}"
SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$HOME/Library/Android/sdk}}"
AVD_DIR="${ANDROID_AVD_HOME:-$HOME/.android/avd}/${AVD_NAME}.avd"
ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR="${SDK_ROOT}/emulator/emulator"
LOG_FILE="${BACI_ANDROID_EMULATOR_LOG:-/tmp/baci-mobile-admin-emulator.log}"
BOOT_TIMEOUT_SECONDS="${BACI_ANDROID_BOOT_TIMEOUT_SECONDS:-420}"
EMULATOR_PORT="${BACI_ANDROID_EMULATOR_PORT:-5554}"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}}"
MIN_EMULATOR_BUILD="${BACI_ANDROID_MIN_EMULATOR_BUILD:-15261927}"
ADB_STABILITY_PROBES="${BACI_ANDROID_ADB_STABILITY_PROBES:-3}"
EMULATOR_MEMORY_MB="${BACI_ANDROID_EMULATOR_MEMORY_MB:-4096}"
EMULATOR_CORES="${BACI_ANDROID_EMULATOR_CORES:-2}"
COLD_BOOT="${BACI_ANDROID_COLD_BOOT:-0}"
DNS_SERVERS="${BACI_ANDROID_DNS_SERVERS:-8.8.8.8,1.1.1.1}"
SETTLE_TIMEOUT_SECONDS="${BACI_ANDROID_SETTLE_TIMEOUT_SECONDS:-600}"
SETTLE_LOAD_MAX="${BACI_ANDROID_SETTLE_LOAD_MAX:-8.0}"
SETTLE_STABILITY_PROBES="${BACI_ANDROID_SETTLE_STABILITY_PROBES:-2}"
METRO_PORT="${BACI_ANDROID_METRO_PORT:-8081}"
cleanup_files=()

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="${SDK_ROOT}/platform-tools:${SDK_ROOT}/emulator:${SDK_ROOT}/cmdline-tools/latest/bin:${PATH}"

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

  if ((${#remaining[@]} == 0)); then
    cleanup_files=()
  else
    cleanup_files=("${remaining[@]}")
  fi
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
  echo "Refusing -gpu swiftshader_indirect for mobile-admin QA; use host or auto." >&2
  exit 1
fi

if [[ "$COLD_BOOT" != "0" && "$COLD_BOOT" != "1" ]]; then
  echo "BACI_ANDROID_COLD_BOOT must be 0 or 1." >&2
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

if ! "$EMULATOR" -list-avds | grep -Fxq -- "$AVD_NAME"; then
  echo "Required AVD '$AVD_NAME' is not installed." >&2
  echo "Use the mobile-admin Android QA setup path before launching:" >&2
  echo "  ${SDK_ROOT}/cmdline-tools/latest/bin/sdkmanager --sdk_root=${SDK_ROOT} \"emulator\" \"platform-tools\" \"${ANDROID_PLATFORM_PACKAGE}\" \"${ANDROID_SYSTEM_IMAGE_PACKAGE}\"" >&2
  echo "  printf 'no\\n' | ${SDK_ROOT}/cmdline-tools/latest/bin/avdmanager create avd --force --name ${AVD_NAME} --package \"${ANDROID_SYSTEM_IMAGE_PACKAGE}\" --device \"${ANDROID_DEVICE_PROFILE}\"" >&2
  echo "Then launch only with: pnpm --filter baci-mobile-admin android:emulator" >&2
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

remove_stale_avd_locks() {
  local lock_file

  if [[ ! -d "$AVD_DIR" ]]; then
    return 0
  fi

  if "$ADB" devices | grep -q "^${ADB_SERIAL}[[:space:]]"; then
    return 0
  fi

  if command -v pgrep >/dev/null 2>&1 && pgrep -f "[e]mulator.*@${AVD_NAME}|[q]emu-system.*${AVD_NAME}" >/dev/null 2>&1; then
    return 0
  fi

  while IFS= read -r -d '' lock_file; do
    rm -f "$lock_file"
    echo "Removed stale AVD lock: $lock_file"
  done < <(find "$AVD_DIR" -maxdepth 1 -type f -name '*.lock' -print0)
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

stabilize_android_system() {
  local package_name
  local package_names=(
    com.android.bluetooth
    com.android.launcher3
    com.android.quicksearchbox
    com.android.localtransport
    com.android.printspooler
  )

  "$ADB" -s "$ADB_SERIAL" shell svc bluetooth disable >/dev/null 2>&1 || true
  "$ADB" -s "$ADB_SERIAL" shell settings put global bluetooth_on 0 >/dev/null 2>&1 || true
  "$ADB" -s "$ADB_SERIAL" shell settings put global window_animation_scale 0 >/dev/null 2>&1 || true
  "$ADB" -s "$ADB_SERIAL" shell settings put global transition_animation_scale 0 >/dev/null 2>&1 || true
  "$ADB" -s "$ADB_SERIAL" shell settings put global animator_duration_scale 0 >/dev/null 2>&1 || true
  "$ADB" -s "$ADB_SERIAL" reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" >/dev/null 2>&1 || true

  for package_name in "${package_names[@]}"; do
    "$ADB" -s "$ADB_SERIAL" shell cmd package disable-user --user 0 "$package_name" >/dev/null 2>&1 || true
  done
}

wait_for_android_settle() {
  local deadline=$((SECONDS + SETTLE_TIMEOUT_SECONDS))
  local load_output
  local load_one
  local stable_probe_count=0

  while (( SECONDS < deadline )); do
    load_output="$(mktemp)"
    track_temp_file "$load_output"
    if capture_with_timeout 5 "$load_output" "$ADB" -s "$ADB_SERIAL" shell cat /proc/loadavg; then
      load_one="$(awk '{print $1}' "$load_output")"
      if awk -v load="$load_one" -v max="$SETTLE_LOAD_MAX" 'BEGIN { exit !(load <= max) }'; then
        stable_probe_count=$((stable_probe_count + 1))
        if (( stable_probe_count >= SETTLE_STABILITY_PROBES )); then
          remove_temp_file "$load_output"
          return 0
        fi
      else
        stable_probe_count=0
      fi
      echo "Android load average: ${load_one:-unknown} (target <= $SETTLE_LOAD_MAX)"
    else
      stable_probe_count=0
    fi
    remove_temp_file "$load_output"
    sleep 5
  done

  return 1
}

echo "Starting Android emulator for mobile-admin QA"
echo "AVD: $AVD_NAME"
echo "Platform package: $ANDROID_PLATFORM_PACKAGE"
echo "System image: $ANDROID_SYSTEM_IMAGE_PACKAGE"
echo "Device profile: $ANDROID_DEVICE_PROFILE"
echo "Emulator port: $EMULATOR_PORT"
echo "GPU: $GPU_MODE"
echo "Cores: $EMULATOR_CORES"
echo "Memory: ${EMULATOR_MEMORY_MB}MB"
echo "Cold boot: $COLD_BOOT"
echo "DNS servers: ${DNS_SERVERS:-host default}"
echo "Emulator: $emulator_version_output"
echo "Log: $LOG_FILE"

"$ADB" kill-server >/dev/null 2>&1 || true
"$ADB" start-server >/dev/null

if "$ADB" devices | grep -q "^${ADB_SERIAL}[[:space:]]"; then
  "$ADB" -s "$ADB_SERIAL" emu kill >/dev/null 2>&1 || true
  sleep 3
fi
remove_stale_avd_locks

rm -f "$LOG_FILE"
emulator_pid="$(
  python3 - "$EMULATOR" "$AVD_NAME" "$GPU_MODE" "$EMULATOR_PORT" "$LOG_FILE" "$EMULATOR_MEMORY_MB" "$EMULATOR_CORES" "$COLD_BOOT" "$DNS_SERVERS" <<'PY'
import subprocess
import sys

emulator, avd_name, gpu_mode, emulator_port, log_file, memory_mb, cores, cold_boot, dns_servers = sys.argv[1:]
log = open(log_file, 'ab', buffering=0)
emulator_args = [
    emulator,
    f'@{avd_name}',
    '-gpu',
    gpu_mode,
    '-port',
    emulator_port,
    '-no-boot-anim',
    '-no-audio',
    '-netdelay',
    'none',
    '-netspeed',
    'full',
    '-memory',
    memory_mb,
    '-cores',
    cores,
]
if dns_servers:
    emulator_args.extend(['-dns-server', dns_servers])
if cold_boot == '1':
    emulator_args.append('-no-snapshot-load')
process = subprocess.Popen(
    emulator_args,
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

stabilize_android_system

if ! wait_for_android_settle; then
  echo "Emulator booted, but Android did not settle below load ${SETTLE_LOAD_MAX} within ${SETTLE_TIMEOUT_SECONDS}s." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  kill "$emulator_pid" >/dev/null 2>&1 || true
  exit 1
fi

echo "Android emulator ready on $ADB_SERIAL."
echo "Use this emulator for QA; do not relaunch it with raw emulator commands or -gpu swiftshader_indirect."
