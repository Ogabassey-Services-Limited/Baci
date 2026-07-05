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

register_temp_file_cleanup_traps() {
  trap cleanup EXIT
  trap 'cleanup; exit 130' INT
  trap 'cleanup; exit 143' TERM
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

run_stabilization_adb() {
  local timeout_seconds="${BACI_ANDROID_STABILIZE_ADB_TIMEOUT_SECONDS:-10}"
  local status

  set +e
  run_with_timeout "$timeout_seconds" "$ADB" -s "$ADB_SERIAL" "$@" >/dev/null 2>&1
  status=$?
  set -e

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
