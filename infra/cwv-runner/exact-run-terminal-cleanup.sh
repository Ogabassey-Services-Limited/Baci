#!/bin/sh
set -eu

PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077

readonly STATE_ROOT=/srv/baci-cwv/campaigns CONTROL_ROOT=/srv/baci-cwv/exact-runs DOCKER_SOCKET=unix:///run/baci-cwv/docker.sock
readonly ALLOW_ROOT=/srv/baci-cwv/allow INVENTORY_ROOT=/srv/baci-cwv/inventory RELEASE_ROOT=/srv/baci-cwv/listener-release ENV_FILE=/etc/baci-cwv/measurement.env SAMPLER_ENV=/run/baci-cwv/host-sampler.env
readonly SERVICE_CGROUP=/cwv-measurement-control.slice/baci-cwv-measurement.service MEASUREMENT_SLICE=/sys/fs/cgroup/cwv-measurement.slice

observe_terminal=0
case "$#:${1-}" in
  1:*) campaign_id=$1 ;;
  2:--observe-terminal) observe_terminal=1; campaign_id=$2 ;;
  *) exit 64 ;;
esac
printf '%s' "$campaign_id" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$' || exit 64
directory="$CONTROL_ROOT/$campaign_id" active="$directory/active-transaction.json"
[ -e "$active" ] || { [ "$observe_terminal" -eq 1 ] && exit 1; exit 0; }
root_mode() { [ -f "$1" ] && [ ! -L "$1" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$1")" = 0:600 ]; }
digest() { /usr/bin/sha256sum "$1" | /usr/bin/cut -d' ' -f1; }
replace_active() { temporary="$active.tmp-$$"; printf '%s' "$1" >"$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$active"; /usr/bin/sync -f "$directory"; }
root_mode "$active" && root_mode "$directory/binding.json" && root_mode "$STATE_ROOT/$campaign_id/capture.sha256" || exit 65
canonical=$(/usr/bin/jq -cS . "$active") && [ "$(/bin/cat "$active")" = "$canonical" ] || exit 65
capture_sha=$(/bin/cat "$STATE_ROOT/$campaign_id/capture.sha256")
/usr/bin/jq -e --arg campaign "$campaign_id" --arg capture "$capture_sha" --arg binding "$(digest "$directory/binding.json")" 'keys == ["artifacts","campaignId","captureSha256","controllerBindingSha256","generation","schemaVersion"] and .campaignId == $campaign and .captureSha256 == $capture and .controllerBindingSha256 == $binding and .generation == 1 and .schemaVersion == 1 and (.artifacts|keys == ["allow","environment","inventory","release","samplerEnvironment"]) and all(.artifacts[]; . == null or (type == "string" and test("^[a-f0-9]{64}$")))' "$active" >/dev/null || exit 65
empty_or_absent() { [ ! -e "$1" ] || { [ -r "$1/cgroup.procs" ] && [ ! -s "$1/cgroup.procs" ]; }; }
stop_measurement() { /bin/systemctl stop baci-cwv-measurement.service 2>/dev/null || return 1; [ "$(/bin/systemctl show baci-cwv-measurement.service -p ActiveState --value)" = inactive ] && [ "$(/bin/systemctl show baci-cwv-measurement.service -p SubState --value)" = dead ] && [ "$(/bin/systemctl show baci-cwv-measurement.service -p MainPID --value)" = 0 ] || return 1; service_cgroup=$(/bin/systemctl show baci-cwv-measurement.service -p ControlGroup --value); [ -z "$service_cgroup" ] || [ "$service_cgroup" = "$SERVICE_CGROUP" ]; empty_or_absent "/sys/fs/cgroup$SERVICE_CGROUP"; }
verify_artifact() { key=$1 path=$2; expected=$(/usr/bin/jq -r --arg key "$key" '.artifacts[$key]' "$active") || return 1; [ "$expected" = null ] && [ ! -e "$path" ] && return 0; printf '%s' "$expected" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' && [ -e "$path" ] && root_mode "$path" && [ "$(digest "$path")" = "$expected" ]; }
remove_artifact() { key=$1 path=$2; verify_artifact "$key" "$path" || return 1; [ ! -e "$path" ] || { /bin/rm -f -- "$path"; /usr/bin/sync -f "$(/usr/bin/dirname -- "$path")"; }; replace_active "$(/usr/bin/jq -cS --arg key "$key" '.artifacts[$key]=null' "$active")"; }
docker_absent() { name=$1; message=$(/usr/bin/docker --host "$DOCKER_SOCKET" container inspect "$name" 2>&1) && return 1; [ "$message" = "Error response from daemon: No such container: $name" ]; }
verify_pre_identity_absent() {
  [ -S "${DOCKER_SOCKET#unix://}" ] || return 1
  docker_absent baci-cwv-measurement || return 1
  containers=$(/usr/bin/docker --host "$DOCKER_SOCKET" ps -aq --no-trunc --filter "label=baci.cwv.transaction=$campaign_id") || return 1
  [ -z "$containers" ] || return 1
  for scope in "$MEASUREMENT_SLICE"/docker-*.scope; do [ ! -e "$scope" ] || empty_or_absent "$scope" || return 1; done
}
verify_runner_absent() {
  identity="$directory/process-identity.json"
  if [ ! -e "$identity" ]; then verify_pre_identity_absent; return; fi
  root_mode "$identity" || return 1; identity_canonical=$(/usr/bin/jq -cS . "$identity") && [ "$(/bin/cat "$identity")" = "$identity_canonical" ] || return 1
  runner_id=$(/usr/bin/jq -er '.runnerContainerId' "$identity") || return 1; cgroup_path=$(/usr/bin/jq -er '.cgroupPath' "$identity") || return 1
  /usr/bin/jq -e --arg id "$runner_id" --arg cgroup "$cgroup_path" 'keys == ["cgroupPath","cpuset","generation","processMapSha256","runnerContainerId"] and .runnerContainerId == $id and .cgroupPath == $cgroup and .generation == 1 and (.runnerContainerId|test("^[a-f0-9]{64}$")) and .cgroupPath == ("/cwv-measurement.slice/docker-" + .runnerContainerId + ".scope") and (.cpuset|test("^[0-9,-]+$")) and (.processMapSha256|test("^[a-f0-9]{64}$"))' "$identity" >/dev/null || return 1
  [ -S "${DOCKER_SOCKET#unix://}" ] || return 1
  if observed=$(/usr/bin/docker --host "$DOCKER_SOCKET" container inspect "$runner_id" 2>&1); then printf '%s' "$observed" | /usr/bin/jq -e --arg id "$runner_id" --arg campaign "$campaign_id" 'length == 1 and .[0].Id == $id and .[0].Config.Labels["baci.cwv.transaction"] == $campaign and .[0].HostConfig.CgroupParent == "cwv-measurement.slice"' >/dev/null || return 1; /usr/bin/docker --host "$DOCKER_SOCKET" stop --time 15 "$runner_id" >/dev/null && /usr/bin/docker --host "$DOCKER_SOCKET" rm -f "$runner_id" >/dev/null || return 1; fi
  docker_absent "$runner_id" || return 1
  scope="/sys/fs/cgroup$cgroup_path"; empty_or_absent "$scope" || return 1
  for sibling in "$MEASUREMENT_SLICE"/docker-*.scope; do [ -e "$sibling" ] || continue; [ "$sibling" = "$scope" ] || return 1; empty_or_absent "$sibling" || return 1; done
}

observe_empty_or_absent() { [ ! -L "$1" ] && empty_or_absent "$1"; }
observe_service_terminal() {
  [ "$(/bin/systemctl show baci-cwv-measurement.service -p ActiveState --value)" = inactive ] && [ "$(/bin/systemctl show baci-cwv-measurement.service -p SubState --value)" = dead ] && [ "$(/bin/systemctl show baci-cwv-measurement.service -p MainPID --value)" = 0 ] || return 1
  service_cgroup=$(/bin/systemctl show baci-cwv-measurement.service -p ControlGroup --value)
  [ -z "$service_cgroup" ] || [ "$service_cgroup" = "$SERVICE_CGROUP" ] || return 1
  observe_empty_or_absent "/sys/fs/cgroup$SERVICE_CGROUP"
}
observe_docker_terminal() {
  [ -S "${DOCKER_SOCKET#unix://}" ] || return 1
  docker_absent baci-cwv-measurement || return 1
  containers=$(/usr/bin/docker --host "$DOCKER_SOCKET" ps -aq --no-trunc --filter 'label=baci.cwv.transaction') || return 1
  [ -z "$containers" ]
}
observe_scopes_terminal() {
  exact_scope=${1-}
  [ -z "$exact_scope" ] || observe_empty_or_absent "/sys/fs/cgroup$exact_scope" || return 1
  for sibling in "$MEASUREMENT_SLICE"/docker-*.scope; do observe_empty_or_absent "$sibling" || return 1; done
}
observe_runner_terminal() {
  identity="$directory/process-identity.json"
  [ ! -L "$identity" ] || return 1
  if [ -e "$identity" ]; then
    root_mode "$identity" || return 1
    identity_canonical=$(/usr/bin/jq -cS . "$identity") && [ "$(/bin/cat "$identity")" = "$identity_canonical" ] || return 1
    runner_id=$(/usr/bin/jq -er '.runnerContainerId' "$identity") || return 1; cgroup_path=$(/usr/bin/jq -er '.cgroupPath' "$identity") || return 1
    /usr/bin/jq -e --arg id "$runner_id" --arg cgroup "$cgroup_path" 'keys == ["cgroupPath","cpuset","generation","processMapSha256","runnerContainerId"] and .runnerContainerId == $id and .cgroupPath == $cgroup and .generation == 1 and (.runnerContainerId|test("^[a-f0-9]{64}$")) and .cgroupPath == ("/cwv-measurement.slice/docker-" + .runnerContainerId + ".scope") and (.cpuset|test("^[0-9,-]+$")) and (.processMapSha256|test("^[a-f0-9]{64}$"))' "$identity" >/dev/null || return 1
    docker_absent "$runner_id" || return 1
  else
    cgroup_path=
  fi
  observe_docker_terminal && observe_scopes_terminal "$cgroup_path"
}

if [ "$observe_terminal" -eq 1 ]; then
  observe_service_terminal && observe_runner_terminal || exit 1
  printf '%s\n' '{"busy":false,"phase":"terminal","processes":[]}'
  exit 0
fi

stop_measurement && verify_runner_absent || exit 1
remove_artifact allow "$ALLOW_ROOT/active.json"
remove_artifact inventory "$INVENTORY_ROOT/active.json"
remove_artifact release "$RELEASE_ROOT/release.json"
remove_artifact environment "$ENV_FILE"
/bin/systemctl stop baci-cwv-host-sampler.timer 2>/dev/null || exit 1
remove_artifact samplerEnvironment "$SAMPLER_ENV"
