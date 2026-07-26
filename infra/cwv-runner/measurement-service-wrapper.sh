#!/bin/bash
set -euo pipefail

readonly DOCKER_SOCKET=unix:///run/baci-cwv/docker.sock
readonly CONTAINER_NAME=baci-cwv-measurement
readonly STATIC_ENV=(
  PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
  LC_ALL=C.UTF-8
  TZ=Etc/UTC
  HOME=/var/empty/baci-cwv
)

fail() {
  /usr/bin/printf '%s\n' "$1" >&2
  exit 65
}

stat_identity() {
  case "$(/usr/bin/uname -s)" in
    Linux) /usr/bin/stat -c '%u:%g:%a' -- "$1" ;;
    Darwin) /usr/bin/stat -f '%u:%g:%Lp' -- "$1" ;;
    *) fail 'unsupported host' ;;
  esac
}

sha256_digest() {
  case "$(/usr/bin/uname -s)" in
    Linux) /usr/bin/sha256sum "$1" | /usr/bin/awk '{ print $1 }' ;;
    Darwin) /usr/bin/shasum -a 256 "$1" | /usr/bin/awk '{ print $1 }' ;;
    *) fail 'unsupported host' ;;
  esac
}

assert_file() {
  [ -f "$1" ] && [ ! -L "$1" ] || fail 'input must be a regular file'
  [ "$(stat_identity "$1")" = "$2" ] || fail 'input ownership or mode'
}

baci_cwv_gid() {
  /usr/bin/getent group baci-cwv | /usr/bin/awk -F: '$3 ~ /^[0-9]+$/ { print $3; found = 1; exit } END { exit !found }'
}

assert_dynamic_file() {
  local expected
  expected="0:$(baci_cwv_gid):440" || fail 'runner group missing'
  assert_file "$1" "$expected"
}

assert_snapshot_directory() {
  [ -d "$1" ] && [ ! -L "$1" ] || fail 'snapshot directory missing'
  [ "$(stat_identity "$1")" = 0:0:700 ] || fail 'snapshot directory ownership or mode'
}

validate_image_file() {
  [ "$(/usr/bin/wc -l < "$1")" -eq 1 ] || fail 'image input line count'
  [ "$(/usr/bin/wc -c < "$1")" -eq 90 ] || fail 'image input byte count'
  /usr/bin/grep -Eq '^BACI_CWV_IMAGE_ID=sha256:[a-f0-9]{64}$' "$1" || fail 'image input format'
  /usr/bin/printf '%s' "$(/bin/cat "$1")"
}

validate_dynamic_content() {
  local content=$1 before deadline keys
  [ "$(/usr/bin/printf '%s\n' "$content" | /usr/bin/wc -l)" -eq 4 ] || fail 'dynamic input line count'
  keys=$(/usr/bin/printf '%s\n' "$content" | /usr/bin/cut -d= -f1 | LC_ALL=C /usr/bin/sort | /usr/bin/tr '\n' ' ')
  [ "$keys" = 'BACI_CWV_CAMPAIGN_ID BACI_CWV_CAPTURE_SHA256 BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS ' ] || fail 'dynamic input keys'
  /usr/bin/printf '%s\n' "$content" | /usr/bin/grep -Eq '^BACI_CWV_CAMPAIGN_ID=[a-z0-9][a-z0-9-]{0,62}$' || fail 'campaign id'
  /usr/bin/printf '%s\n' "$content" | /usr/bin/grep -Eq '^BACI_CWV_CAPTURE_SHA256=[a-f0-9]{64}$' || fail 'capture digest'
  /usr/bin/printf '%s\n' "$content" | /usr/bin/grep -Eq '^BACI_CWV_LISTENER_RELEASE_(NOT_BEFORE|DEADLINE)_MONOTONIC_SECONDS=(0|[1-9][0-9]*)$' || fail 'listener release bounds'
  before=$(/usr/bin/printf '%s\n' "$content" | /usr/bin/awk -F= '$1 == "BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS" { print $2 }')
  deadline=$(/usr/bin/printf '%s\n' "$content" | /usr/bin/awk -F= '$1 == "BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS" { print $2 }')
  [ "$deadline" -ge "$before" ] || fail 'listener release order'
}

validate_dynamic_file() {
  local content
  assert_dynamic_file "$1"
  content=$(/bin/cat "$1") || fail 'dynamic input read'
  validate_dynamic_content "$content"
  /usr/bin/printf '%s\n' "$content"
}

validate_snapshot() {
  local snapshot=$1 image content
  assert_file "$snapshot" 0:0:400
  [ "$(/usr/bin/wc -l < "$snapshot")" -eq 5 ] || fail 'snapshot line count'
  image=$(/usr/bin/head -n 1 "$snapshot") || fail 'snapshot image read'
  /usr/bin/printf '%s\n' "$image" | /usr/bin/grep -Eq '^BACI_CWV_IMAGE_ID=sha256:[a-f0-9]{64}$' || fail 'snapshot image format'
  content=$(/usr/bin/tail -n +2 "$snapshot") || fail 'snapshot dynamic read'
  validate_dynamic_content "$content"
}

prepare() {
  local snapshot=$1 image=$2 receipt=$3 dynamic=$4 directory temporary image_value dynamic_value
  directory=${snapshot%/*}
  assert_snapshot_directory "$directory"
  assert_file "$image" 0:0:644
  assert_file "$receipt" 0:0:644
  image_value=$(validate_image_file "$image")
  /usr/bin/printf '%s\n' "$(sha256_digest "$image")" | /usr/bin/cmp -s - "$receipt" || fail 'image receipt mismatch'
  dynamic_value=$(validate_dynamic_file "$dynamic")
  [ ! -e "$snapshot" ] && [ ! -L "$snapshot" ] || assert_file "$snapshot" 0:0:400
  temporary=$(/usr/bin/mktemp "$directory/.measurement-service.XXXXXX") || fail 'snapshot create'
  trap '/bin/rm -f -- "$temporary"' EXIT HUP INT TERM
  { /usr/bin/printf '%s\n' "$image_value"; /usr/bin/printf '%s\n' "$dynamic_value"; } >"$temporary"
  /bin/chmod 0400 "$temporary"
  validate_snapshot "$temporary"
  /bin/mv -f "$temporary" "$snapshot"
  trap - EXIT HUP INT TERM
}

start() {
  local snapshot=$1
  validate_snapshot "$snapshot"
  set -a
  # shellcheck disable=SC1090
  . "$snapshot"
  set +a
  exec /usr/bin/env -i "${STATIC_ENV[@]}" \
    BACI_CWV_CAMPAIGN_ID="$BACI_CWV_CAMPAIGN_ID" \
    BACI_CWV_CAPTURE_SHA256="$BACI_CWV_CAPTURE_SHA256" \
    BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS="$BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS" \
    BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS="$BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS" \
    /usr/bin/docker --host="$DOCKER_SOCKET" run --pull=never --rm \
      --name="$CONTAINER_NAME" \
      --label="baci.cwv.transaction=$BACI_CWV_CAMPAIGN_ID" \
      --network=baci-cwv-net \
      --user=10001:10001 \
      --cap-drop=ALL \
      --security-opt=no-new-privileges=true \
      --cgroup-parent=cwv-measurement.slice \
      --cpuset-cpus=2-3 \
      --memory=8g \
      --memory-swap=8g \
      --pids-limit=1024 \
      --shm-size=1073741824 \
      --read-only \
      --tmpfs=/tmp:rw,noexec,nosuid,nodev,size=268435456,mode=1777 \
      --tmpfs=/home/runner:rw,noexec,nosuid,nodev,size=67108864,mode=0700,uid=10001,gid=10001 \
      --volume=/srv/baci-cwv/sealed/actions-runner:/opt/runner:ro \
      --volume=/srv/baci-cwv/writable/_diag:/opt/runner/_diag:rw \
      --volume=/srv/baci-cwv/writable/_work:/runner-work:rw \
      --volume=/srv/baci-cwv/writable/scratch:/runner-scratch:rw \
      --volume=/srv/baci-cwv/sealed/policy.sha256:/run/baci-cwv-policy/policy.sha256:ro \
      --volume=/srv/baci-cwv/hooks/job-start-hook.sh:/run/baci-cwv-hooks/job-start-hook.sh:ro \
      --volume=/srv/baci-cwv/allow:/run/baci-cwv-admission:ro \
      --volume=/srv/baci-cwv/listener-release:/run/baci-cwv-listener-release:ro \
      --volume=/srv/baci-cwv/evidence:/host-evidence:ro \
      --env=DISABLE_RUNNER_UPDATE=1 \
      --env=ACTIONS_RUNNER_HOOK_JOB_STARTED=/run/baci-cwv-hooks/job-start-hook.sh \
      --env=BACI_CWV_CAMPAIGN_ID \
      --env=BACI_CWV_CAPTURE_SHA256 \
      --env=BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS \
      --env=BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS \
      -- "$BACI_CWV_IMAGE_ID"
}

docker_stop() {
  /usr/bin/docker --host="$DOCKER_SOCKET" stop --time=15 "$CONTAINER_NAME"
}

docker_inspect() {
  /usr/bin/docker --host="$DOCKER_SOCKET" container inspect "$CONTAINER_NAME"
}

stop_measurement() {
  local status message
  docker_stop && return 0
  status=$?
  message=$(docker_inspect 2>&1) && return "$status"
  [ "$message" = "Error response from daemon: No such container: $CONTAINER_NAME" ] && return 0
  /usr/bin/printf '%s\n' "$message" >&2
  return "$status"
}

main() {
  case "${1-}" in
    prepare) [ "$#" -eq 5 ] || fail 'prepare arguments'; prepare "${@:2}" ;;
    start) [ "$#" -eq 2 ] || fail 'start arguments'; start "$2" ;;
    stop) [ "$#" -eq 1 ] || fail 'stop arguments'; stop_measurement ;;
    *) fail 'usage: measurement-service-wrapper.sh prepare|start|stop' ;;
  esac
}

[ "${MEASUREMENT_SERVICE_WRAPPER_LIBRARY:-}" = 1 ] || main "$@"
