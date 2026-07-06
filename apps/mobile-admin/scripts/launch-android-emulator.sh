#!/usr/bin/env bash
set -euo pipefail

# Both apps' QA launchers intentionally share one emulator instance (same AVD,
# same port 5554): the host runs a single 4 GB QA AVD and the apps install
# side by side; run their QA flows sequentially. For concurrent emulators,
# override BACI_ANDROID_AVD_NAME and BACI_ANDROID_EMULATOR_PORT explicitly.
AVD_NAME="${BACI_ANDROID_AVD_NAME:-Baci_Pixel_9_Pro_XL_API_36_Google}"
ANDROID_PLATFORM_PACKAGE="${BACI_ANDROID_PLATFORM_PACKAGE:-platforms;android-36}"
ANDROID_SYSTEM_IMAGE_PACKAGE="${BACI_ANDROID_SYSTEM_IMAGE_PACKAGE:-system-images;android-36;google_apis;arm64-v8a}"
ANDROID_DEVICE_PROFILE="${BACI_ANDROID_DEVICE_PROFILE:-pixel_9_pro_xl}"
GPU_MODE="${BACI_ANDROID_GPU_MODE:-auto}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

source "${SCRIPT_DIR}/lib/timeout.sh"
source "${SCRIPT_DIR}/lib/android-common.sh"

SDK_ROOT="${ANDROID_SDK_ROOT:-${ANDROID_HOME:-$(default_sdk_root)}}"
AVD_DIR="${ANDROID_AVD_HOME:-$HOME/.android/avd}/${AVD_NAME}.avd"
ADB="${SDK_ROOT}/platform-tools/adb"
EMULATOR="${SDK_ROOT}/emulator/emulator"
LOG_FILE="${BACI_ANDROID_EMULATOR_LOG:-/tmp/baci-mobile-admin-emulator.log}"
BOOT_TIMEOUT_SECONDS="${BACI_ANDROID_BOOT_TIMEOUT_SECONDS:-420}"
EMULATOR_PORT="${BACI_ANDROID_EMULATOR_PORT:-5554}"
ADB_SERIAL="${BACI_ANDROID_ADB_SERIAL:-emulator-${EMULATOR_PORT}}"
MIN_EMULATOR_BUILD="${BACI_ANDROID_MIN_EMULATOR_BUILD:-15261927}"
ADB_STABILITY_PROBES="${BACI_ANDROID_ADB_STABILITY_PROBES:-3}"
ADB_SERVER_TIMEOUT_SECONDS="${BACI_ANDROID_ADB_SERVER_TIMEOUT_SECONDS:-20}"
OLD_EMULATOR_SHUTDOWN_TIMEOUT_SECONDS="${BACI_ANDROID_OLD_EMULATOR_SHUTDOWN_TIMEOUT_SECONDS:-60}"
EMULATOR_MEMORY_MB="${BACI_ANDROID_EMULATOR_MEMORY_MB:-4096}"
EMULATOR_CORES="${BACI_ANDROID_EMULATOR_CORES:-2}"
COLD_BOOT="${BACI_ANDROID_COLD_BOOT:-0}"
DNS_SERVERS="${BACI_ANDROID_DNS_SERVERS:-8.8.8.8,1.1.1.1}"
SETTLE_TIMEOUT_SECONDS="${BACI_ANDROID_SETTLE_TIMEOUT_SECONDS:-600}"
SETTLE_LOAD_MAX="${BACI_ANDROID_SETTLE_LOAD_MAX:-8.0}"
SETTLE_STABILITY_PROBES="${BACI_ANDROID_SETTLE_STABILITY_PROBES:-2}"
METRO_PORT="${BACI_ANDROID_METRO_PORT:-8081}"
register_temp_file_cleanup_traps

export ANDROID_HOME="$SDK_ROOT"
export ANDROID_SDK_ROOT="$SDK_ROOT"
export PATH="${SDK_ROOT}/platform-tools:${SDK_ROOT}/emulator:${SDK_ROOT}/cmdline-tools/latest/bin:${PATH}"

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

run_with_timeout "$ADB_SERVER_TIMEOUT_SECONDS" "$ADB" kill-server >/dev/null 2>&1 || true
if ! run_with_timeout "$ADB_SERVER_TIMEOUT_SECONDS" "$ADB" start-server >/dev/null; then
  echo "Timed out starting adb server within ${ADB_SERVER_TIMEOUT_SECONDS}s." >&2
  exit 1
fi

if adb_serial_is_listed "$ADB_SERVER_TIMEOUT_SECONDS"; then
  run_with_timeout "$ADB_SERVER_TIMEOUT_SECONDS" "$ADB" -s "$ADB_SERIAL" emu kill >/dev/null 2>&1 || true
  if ! wait_for_emulator_shutdown "$OLD_EMULATOR_SHUTDOWN_TIMEOUT_SECONDS" "$ADB_SERVER_TIMEOUT_SECONDS"; then
    echo "Previous emulator on ${ADB_SERIAL} did not shut down within ${OLD_EMULATOR_SHUTDOWN_TIMEOUT_SECONDS}s." >&2
    exit 1
  fi
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
track_cleanup_process "$emulator_pid"
echo "Emulator PID: $emulator_pid"

if ! wait_for_adb_shell_ready "$BOOT_TIMEOUT_SECONDS"; then
  echo "Emulator did not reach a responsive adb shell within ${BOOT_TIMEOUT_SECONDS}s." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  terminate_process_group "$emulator_pid"
  exit 1
fi

if ! confirm_adb_shell_stable "$ADB_STABILITY_PROBES"; then
  echo "Emulator booted, but adb shell did not stay responsive." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  terminate_process_group "$emulator_pid"
  exit 1
fi

if ! stabilize_android_system; then
  echo "Emulator booted, but Android stabilization timed out." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  terminate_process_group "$emulator_pid"
  exit 1
fi

if ! wait_for_android_load_settle "$SETTLE_TIMEOUT_SECONDS" "$SETTLE_LOAD_MAX" "$SETTLE_STABILITY_PROBES"; then
  echo "Emulator booted, but Android did not settle below load ${SETTLE_LOAD_MAX} within ${SETTLE_TIMEOUT_SECONDS}s." >&2
  echo "Last emulator log lines:" >&2
  tail -40 "$LOG_FILE" >&2 || true
  terminate_process_group "$emulator_pid"
  exit 1
fi

untrack_cleanup_process "$emulator_pid"
echo "Android emulator ready on $ADB_SERIAL."
echo "Use this emulator for QA; do not relaunch it with raw emulator commands or -gpu swiftshader_indirect."
