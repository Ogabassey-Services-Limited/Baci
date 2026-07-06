#!/usr/bin/env bash

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

cleanup_files=()
cleanup_processes=()

cleanup() {
  cleanup_process_groups
  if ((${#cleanup_files[@]} > 0)); then
    rm -f "${cleanup_files[@]}" 2>/dev/null || true
  fi
}

track_temp_file() { cleanup_files+=("$1"); }

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
  rm -f "$target" 2>/dev/null || true
  untrack_temp_file "$target"
}

track_cleanup_process() { cleanup_processes+=("$1"); }

untrack_cleanup_process() {
  local target="$1"
  local remaining=()
  local process_pid
  for process_pid in "${cleanup_processes[@]}"; do
    if [[ "$process_pid" != "$target" ]]; then
      remaining+=("$process_pid")
    fi
  done
  if ((${#remaining[@]} == 0)); then
    cleanup_processes=()
  else
    cleanup_processes=("${remaining[@]}")
  fi
}

cleanup_process_groups() {
  local index
  local process_pid
  for ((index = ${#cleanup_processes[@]} - 1; index >= 0; index--)); do
    process_pid="${cleanup_processes[$index]}"
    terminate_process_group "$process_pid"
  done
  cleanup_processes=()
}

run_exit_cleanup() {
  local status=$?
  trap - EXIT
  cleanup
  exit "$status"
}

run_interrupt_cleanup() {
  local status="$1"
  trap - EXIT
  cleanup
  exit "$status"
}

register_temp_file_cleanup_traps() {
  trap run_exit_cleanup EXIT
  trap 'run_interrupt_cleanup 130' INT
  trap 'run_interrupt_cleanup 143' TERM
}

adb_serial_is_listed() {
  local timeout_seconds="${1:-5}"
  local devices_output
  devices_output="$(mktemp)"
  track_temp_file "$devices_output"
  if capture_with_timeout "$timeout_seconds" "$devices_output" "$ADB" devices; then
    if grep -q "^${ADB_SERIAL}[[:space:]]" "$devices_output"; then
      remove_temp_file "$devices_output"
      return 0
    fi
  fi
  remove_temp_file "$devices_output"
  return 1
}

emulator_process_is_running() {
  command -v pgrep >/dev/null 2>&1 &&
    pgrep -f "[e]mulator.*@${AVD_NAME}|[q]emu-system.*${AVD_NAME}" >/dev/null 2>&1
}

avd_lock_exists() {
  [[ -d "$AVD_DIR" ]] &&
    find "$AVD_DIR" -maxdepth 1 -name '*.lock' -print -quit | grep -q .
}

wait_for_emulator_shutdown() {
  local timeout_seconds="$1"
  local adb_timeout_seconds="${2:-5}"
  local deadline=$((SECONDS + timeout_seconds))
  while ((SECONDS < deadline)); do
    if ! adb_serial_is_listed "$adb_timeout_seconds" && ! emulator_process_is_running; then
      remove_stale_avd_locks
      if ! avd_lock_exists; then
        return 0
      fi
    fi
    sleep 2
  done
  return 1
}

remove_stale_avd_locks() {
  local lock_file
  if [[ ! -d "$AVD_DIR" ]]; then
    return 0
  fi
  if adb_serial_is_listed "${ADB_SERVER_TIMEOUT_SECONDS:-${BACI_ANDROID_ADB_SERVER_TIMEOUT_SECONDS:-5}}"; then
    return 0
  fi
  if emulator_process_is_running; then
    return 0
  fi
  while IFS= read -r -d '' lock_file; do
    rm -rf "$lock_file"
    echo "Removed stale AVD lock: $lock_file"
  done < <(find "$AVD_DIR" -maxdepth 1 -name '*.lock' -print0)
}

terminate_process_group() {
  local process_pid="$1"
  kill -- "-${process_pid}" >/dev/null 2>&1 || kill "$process_pid" >/dev/null 2>&1 || true
  local waited=0
  while ((waited < 5)); do
    if ! kill -0 -- "-${process_pid}" >/dev/null 2>&1 && ! kill -0 "$process_pid" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
    waited=$((waited + 1))
  done
  kill -9 -- "-${process_pid}" >/dev/null 2>&1 || kill -9 "$process_pid" >/dev/null 2>&1 || true
}

wait_for_adb_shell_ready() {
  local timeout_seconds="$1"
  local probe_timeout_seconds="${2:-5}"
  local deadline=$((SECONDS + timeout_seconds))
  local boot_output
  local probe_output
  while ((SECONDS < deadline)); do
    boot_output="$(mktemp)"
    track_temp_file "$boot_output"
    if capture_with_timeout "$probe_timeout_seconds" "$boot_output" "$ADB" -s "$ADB_SERIAL" shell getprop sys.boot_completed; then
      if [[ "$(tr -d '\r\n ' < "$boot_output")" == "1" ]]; then
        probe_output="$(mktemp)"
        track_temp_file "$probe_output"
        if capture_with_timeout "$probe_timeout_seconds" "$probe_output" "$ADB" -s "$ADB_SERIAL" shell echo ok; then
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
  local probe_count="$1"
  local probe_timeout_seconds="${2:-5}"
  local probe
  local probe_output
  for ((probe = 1; probe <= probe_count; probe++)); do
    probe_output="$(mktemp)"
    track_temp_file "$probe_output"
    if ! capture_with_timeout "$probe_timeout_seconds" "$probe_output" "$ADB" -s "$ADB_SERIAL" shell echo ok; then
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

wait_for_android_load_settle() {
  local timeout_seconds="$1"
  local load_max="$2"
  local stability_probe_count="$3"
  local probe_timeout_seconds="${4:-5}"
  local deadline=$((SECONDS + timeout_seconds))
  local load_output
  local load_one
  local stable_probe_count=0
  while ((SECONDS < deadline)); do
    load_output="$(mktemp)"
    track_temp_file "$load_output"
    if capture_with_timeout "$probe_timeout_seconds" "$load_output" "$ADB" -s "$ADB_SERIAL" shell cat /proc/loadavg; then
      load_one="$(awk '{print $1}' "$load_output")"
      if [[ "$load_one" =~ ^[0-9]+([.][0-9]+)?$ ]] &&
        awk -v load_value="$load_one" -v max_load="$load_max" 'BEGIN { exit !(load_value <= max_load) }'; then
        stable_probe_count=$((stable_probe_count + 1))
        if ((stable_probe_count >= stability_probe_count)); then
          remove_temp_file "$load_output"
          return 0
        fi
      else
        stable_probe_count=0
      fi
      echo "Android load average: ${load_one:-unknown} (target <= $load_max)"
    else
      stable_probe_count=0
    fi
    remove_temp_file "$load_output"
    sleep 5
  done
  return 1
}

run_stabilization_adb() {
  local timeout_seconds="${BACI_ANDROID_STABILIZE_ADB_TIMEOUT_SECONDS:-10}"
  local status
  local errexit_was_set=0
  case $- in *e*) errexit_was_set=1 ;; esac
  set +e
  run_with_timeout "$timeout_seconds" "$ADB" -s "$ADB_SERIAL" "$@" >/dev/null 2>&1
  status=$?
  if ((errexit_was_set)); then
    set -e
  fi
  if ((status == 124)); then
    echo "Timed out running adb $* during Android stabilization." >&2
    return 124
  fi
  if ((status != 0)); then
    echo "adb $* failed during Android stabilization with exit ${status}." >&2
    return "$status"
  fi
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
  run_stabilization_adb shell svc bluetooth disable || return $?
  run_stabilization_adb shell settings put global bluetooth_on 0 || return $?
  run_stabilization_adb shell settings put global window_animation_scale 0 || return $?
  run_stabilization_adb shell settings put global transition_animation_scale 0 || return $?
  run_stabilization_adb shell settings put global animator_duration_scale 0 || return $?
  run_stabilization_adb reverse "tcp:${METRO_PORT}" "tcp:${METRO_PORT}" || return $?
  # This is a dedicated Baci QA AVD, not a general manual-use emulator. Disabling
  # the launcher keeps background load stable but removes the home screen until
  # the package is re-enabled or the AVD is reset.
  for package_name in "${package_names[@]}"; do
    run_stabilization_adb shell cmd package disable-user --user 0 "$package_name" || true
  done
}
