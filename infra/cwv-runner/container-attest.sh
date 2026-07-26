#!/bin/sh
# Emits the runtime-only identity projection. This script is deliberately
# separate from host attestation: its disposable probe cannot read host state.
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
LC_ALL=C.UTF-8
TZ=Etc/UTC
HOME=/var/empty/baci-cwv
export PATH LC_ALL TZ HOME
umask 077

readonly IMAGE_FILE=/srv/baci-cwv/image-id
readonly IMAGE_SHA_FILE=/srv/baci-cwv/image-id.sha256
readonly PROJECTION=/srv/baci-cwv/sealed/runtime-runner-binaries
readonly SOCKET=unix:///run/baci-cwv/docker.sock

die() { /usr/bin/printf '%s\n' "$1" >&2; exit 65; }
regular_root_owned() {
  [ -f "$1" ] && [ ! -L "$1" ] &&
    [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$1")" = '0:0:644' ]
}
projection_is_exact() {
  [ -d "$PROJECTION" ] && [ ! -L "$PROJECTION" ] || return 1
  [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$PROJECTION")" = '0:0:555' ] || return 1
  actual=$(
    /usr/bin/find "$PROJECTION" -xdev -printf '%P:%y\n' | /usr/bin/sort
  ) || return 1
  expected=$(
    /usr/bin/printf '%s\n' :d bin:d bin/Runner.Listener:f bin/Runner.Worker:f \
      entrypoint.mjs:f identity-contract.json:f runtime-manifest.json:f |
      /usr/bin/sort
  ) || return 1
  [ "$actual" = "$expected" ]
}
image_id() {
  regular_root_owned "$IMAGE_FILE" || die 'runtime image id file drift'
  regular_root_owned "$IMAGE_SHA_FILE" || die 'runtime image id receipt drift'
  [ "$(/usr/bin/wc -l <"$IMAGE_FILE" | /usr/bin/tr -d ' ')" = 1 ] ||
    die 'runtime image id file drift'
  [ "$(/usr/bin/wc -l <"$IMAGE_SHA_FILE" | /usr/bin/tr -d ' ')" = 1 ] ||
    die 'runtime image id receipt drift'
  line=$(/bin/cat -- "$IMAGE_FILE")
  receipt=$(/bin/cat -- "$IMAGE_SHA_FILE")
  /usr/bin/printf '%s' "$line" |
    /usr/bin/grep -Eq '^BACI_CWV_IMAGE_ID=sha256:[a-f0-9]{64}$' ||
    die 'runtime image id file drift'
  /usr/bin/printf '%s' "$receipt" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' ||
    die 'runtime image id receipt drift'
  [ "$(/usr/bin/sha256sum -- "$IMAGE_FILE" | /usr/bin/cut -d' ' -f1)" = "$receipt" ] ||
    die 'runtime image id receipt drift'
  /usr/bin/printf '%s\n' "${line#BACI_CWV_IMAGE_ID=}"
}
collect() {
  image=$(image_id) || die 'runtime image id collection failed'
  projection_is_exact || die 'runtime projection missing or contains an unreviewed file'
  output=$(
    /usr/bin/timeout 15s /usr/bin/docker --host "$SOCKET" run --pull=never --rm \
      --network=none --read-only --cap-drop=ALL \
      --security-opt=no-new-privileges=true \
      --volume="$PROJECTION:/opt/runner:ro" \
      --tmpfs=/tmp:rw,noexec,nosuid,nodev,size=16777216,mode=1777 \
      --entrypoint=/opt/node/bin/node "$image" \
      /opt/baci-cwv/container-attest-runtime.mjs / "$image"
  ) || die 'runtime collector failed'
  canonical=$( /usr/bin/printf '%s\n' "$output" | /usr/bin/jq -e -cS . ) ||
    die 'runtime attestation must be canonical'
  [ "$canonical" = "$output" ] || die 'runtime attestation must be canonical'
  /usr/bin/printf '%s\n' "$output"
}

case "${1-}" in
  --identity-runtime)
    [ "$#" -eq 1 ] || die 'invalid runtime identity arguments'
    collect
    ;;
  *) die 'invalid runtime identity arguments' ;;
esac
