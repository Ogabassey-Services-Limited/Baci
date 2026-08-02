#!/bin/sh
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077
SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
STATE_ROOT=/srv/baci-cwv/campaigns
CONTROL_ROOT=/srv/baci-cwv/exact-runs
ALLOW_ROOT=/srv/baci-cwv/allow
INVENTORY_ROOT=/srv/baci-cwv/inventory
RELEASE_ROOT=/srv/baci-cwv/listener-release
EVIDENCE_ROOT=/srv/baci-cwv/evidence
TRANSITION_EVIDENCE_ROOT=/srv/baci-cwv/evidence
PROCESS_MAP=/srv/baci-cwv/receipts/image-process-map.json
ENV_FILE=/etc/baci-cwv/measurement.env
SAMPLER_ENV=/run/baci-cwv/host-sampler.env
POLICY="$SCRIPT_DIR/policy.json"
POLICY_TOOL="$SCRIPT_DIR/policy.schema.mjs"
CONTRACT="$SCRIPT_DIR/exact-run-contract-cli.mjs"
TRANSITION_CONTRACT="$SCRIPT_DIR/exact-run-transition-contract.mjs"
LIVE_SAMPLE_CONTRACT="$SCRIPT_DIR/exact-run-live-sample-contract.mjs"
REARM_CONTRACT="$SCRIPT_DIR/exact-run-rearm-contract.mjs"
SOCKET=unix:///run/baci-cwv/docker.sock
cleanup_armed=0 cleanup_phase=idle cleanup_generation='' cleanup_terminal_sha=''
campaign_id='' ACTIVE_TRANSACTION=''
usage() { printf '%s\n' 'usage: exact-run-controller.sh <--begin|--admit|--release|--complete|--abort> <campaign-id>' 'recovery: exact-run-controller.sh --rearm <campaign-id>' >&2; exit 64; }
root_file() { [ -f "$1" ] && [ ! -L "$1" ] && [ "$(/usr/bin/stat -c '%u' -- "$1")" -eq 0 ]; }
digest() ( output=$(/usr/bin/sha256sum "$1") || exit 1; value=${output%% *}; case "$value" in (''|*[!a-f0-9]*) exit 1;; esac; [ "${#value}" -eq 64 ] || exit 1; printf '%s\n' "$value"; )
root_mode() { root_file "$1" && [ "$(/usr/bin/stat -c '%a' -- "$1")" = "$2" ]; }
failpoint() { [ "${BACI_CWV_TEST_FAULT_STAGE-}" = "$1" ] || return 0; [ "${BACI_CWV_TEST_FAULT_ONCE-}" = 1 ] || return 1; [ "${BACI_CWV_TEST_FAULT_CONSUMED-0}" -eq 0 ] && { BACI_CWV_TEST_FAULT_CONSUMED=1; return 1; }; return 0; }
replace_transaction() { temporary="$ACTIVE_TRANSACTION.tmp-$$"; printf '%s\n' "$1" >"$temporary"; /bin/chown root:root "$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$ACTIVE_TRANSACTION"; /usr/bin/sync -f "$(/usr/bin/dirname -- "$ACTIVE_TRANSACTION")"; }
write_active_transaction() { directory=$1 capture_sha=$2 ACTIVE_TRANSACTION="$1/active-transaction.json"; root_mode "$directory/binding.json" 600 && root_mode "$STATE_ROOT/$campaign_id/capture.json" 600 && root_mode "$STATE_ROOT/$campaign_id/capture.sha256" 600 || return 1; [ "$(digest "$STATE_ROOT/$campaign_id/capture.json")" = "$capture_sha" ] && [ "$(/bin/cat "$STATE_ROOT/$campaign_id/capture.sha256")" = "$capture_sha" ] || return 1; failpoint transaction-publication || return 1; replace_transaction "$(/usr/bin/jq -cS -n --arg campaign "$campaign_id" --arg binding "$(digest "$directory/binding.json")" --arg capture "$capture_sha" '{artifacts:{allow:null,environment:null,inventory:null,release:null,samplerEnvironment:null},campaignId:$campaign,captureSha256:$capture,controllerBindingSha256:$binding,generation:1,schemaVersion:1}')"; }
bind_artifact() { directory=$1 key=$2 source=$3; case "$key" in allow|environment|inventory|release|samplerEnvironment) ;; *) return 1 ;; esac; [ "$ACTIVE_TRANSACTION" = "$directory/active-transaction.json" ] && root_file "$source" && root_mode "$ACTIVE_TRANSACTION" 600 || return 1; replace_transaction "$(/usr/bin/jq -cS --arg key "$key" --arg digest "$(digest "$source")" '.artifacts[$key]=$digest' "$ACTIVE_TRANSACTION")"; }
verify_artifact() {
  key=$1 path=$2 expected=$(/usr/bin/jq -r --arg key "$key" '.artifacts[$key]' "$ACTIVE_TRANSACTION") || return 1
  [ "$expected" = null ] && [ ! -e "$path" ] && return 0
  printf '%s' "$expected" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || return 1
  [ -e "$path" ] || return 1; root_file "$path" && [ "$(digest "$path")" = "$expected" ]
}
remove_bound_artifact() { key=$1 path=$2; verify_artifact "$key" "$path" || return 1; if [ -e "$path" ]; then /bin/rm -f -- "$path"; /usr/bin/sync -f "$(/usr/bin/dirname -- "$path")"; fi; replace_transaction "$(/usr/bin/jq -cS --arg key "$key" '.artifacts[$key]=null' "$ACTIVE_TRANSACTION")"; }
verify_active_transaction() {
  directory="$CONTROL_ROOT/$1"; ACTIVE_TRANSACTION="$directory/active-transaction.json"
  root_mode "$ACTIVE_TRANSACTION" 600 && root_mode "$directory/binding.json" 600 && root_mode "$STATE_ROOT/$1/capture.json" 600 && root_mode "$STATE_ROOT/$1/capture.sha256" 600 && [ "$(/usr/bin/jq -cS . "$ACTIVE_TRANSACTION")" = "$(/usr/bin/tr -d '\n' < "$ACTIVE_TRANSACTION")" ] && [ "$(/usr/bin/wc -l < "$ACTIVE_TRANSACTION")" -eq 1 ] || return 1
  capture_sha=$(/bin/cat "$STATE_ROOT/$1/capture.sha256")
  /usr/bin/jq -e --arg campaign "$1" --arg binding "$(digest "$directory/binding.json")" --arg capture "$capture_sha" '
    keys == ["artifacts","campaignId","captureSha256","controllerBindingSha256","generation","schemaVersion"] and .campaignId == $campaign and .generation == 1 and .schemaVersion == 1 and .controllerBindingSha256 == $binding and .captureSha256 == $capture and (.artifacts|keys == ["allow","environment","inventory","release","samplerEnvironment"]) and all(.artifacts[]; . == null or (type == "string" and test("^[a-f0-9]{64}$")))' "$ACTIVE_TRANSACTION" >/dev/null || return 1
  [ "$(digest "$STATE_ROOT/$1/capture.json")" = "$capture_sha" ] || return 1
  verify_artifact allow "$ALLOW_ROOT/active.json" && verify_artifact inventory "$INVENTORY_ROOT/active.json" && verify_artifact release "$RELEASE_ROOT/release.json" && verify_artifact environment "$ENV_FILE" && verify_artifact samplerEnvironment "$SAMPLER_ENV" || return 1
}
monotonic() { /usr/bin/cut -d. -f1 /proc/uptime; }; boot_id() { boot_epoch=$(/bin/cat /proc/sys/kernel/random/boot_id) || return 1; printf '%s' "$boot_epoch" | /usr/bin/grep -Eq '^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$' || return 1; printf '%s\n' "$boot_epoch"; }; before_controller_deadline() { [ "$(monotonic)" -lt "$1" ] && return 0; printf '%s\n' 'controller timeout' >&2; return 1; }
policy() { /usr/bin/node "$POLICY_TOOL" get "$1"; }
install_json() { source=$1 destination=$2 mode=$3 group=$4; root_file "$source"; canonical=$(/usr/bin/jq -cS . "$source"); [ "$(/bin/cat "$source")" = "$canonical" ] || [ "$(/bin/cat "$source")" = "$canonical
" ]; temporary="$destination.tmp-$$"; printf '%s\n' "$canonical" >"$temporary"; /bin/chown "root:$group" "$temporary"; /bin/chmod "$mode" "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$destination"; /usr/bin/sync -f "$(/usr/bin/dirname -- "$destination")"; }

canonical_json() { /usr/bin/jq -cS . "$1"; }
write_receipt() {
  destination=$1 value=$2 temporary="$1.tmp-$$"; printf '%s' "$value" >"$temporary"; /bin/chown root:root "$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$destination"; /usr/bin/sync -f "$(/usr/bin/dirname -- "$destination")"
}
copy_receipt() { source=$1 destination=$2 temporary="$destination.tmp-$$"; root_file "$source"; /bin/cp -- "$source" "$temporary"; /bin/chown root:root "$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$destination"; /usr/bin/sync -f "$(/usr/bin/dirname -- "$destination")"; }
restore_receipt() {
  directory=$1 generation=$2 terminal_sha=$3
  printf '%s' "$terminal_sha" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || return 1
  receipt=$(/usr/bin/jq -cS -n --arg admission "$(/usr/bin/jq -er .admissionId "$directory/binding.json")" --arg terminal "$terminal_sha" --argjson attempt "$(/usr/bin/jq -er .run.attempt "$directory/binding.json")" --argjson run "$(/usr/bin/jq -er .run.id "$directory/binding.json")" --argjson state "$generation" --slurpfile campaignRestore "$STATE_ROOT/$campaign_id/restored.json" '{admissionId:$admission,attempt:$attempt,cleanupComplete:$campaignRestore[0].reconciled,daemonsOffline:($campaignRestore[0].residualState.dedicatedServicesActive == false and $campaignRestore[0].residualState.samplerActive == false),findings:[],networkAbsent:($campaignRestore[0].residualState.dedicatedNetworkPresent == false),processes:[],restored:$campaignRestore[0].reconciled,runId:$run,runnerOffline:($campaignRestore[0].residualState.transactionContainerCount == 0),schemaVersion:1,stateGeneration:$state,terminalProcessesSha256:$terminal}')
  write_receipt "$directory/restore-receipt.json" "$receipt"; write_receipt "$directory/restore-receipt.sha256" "$(digest "$directory/restore-receipt.json")"; root_mode "$directory/restore-receipt.json" 600 && root_mode "$directory/restore-receipt.sha256" 600 && [ "$(/bin/cat "$directory/restore-receipt.sha256")" = "$(digest "$directory/restore-receipt.json")" ]
}
write_root_runtime() { directory=$1 observation=$2; runtime=$(/usr/bin/jq -ceS --slurpfile restore "$directory/restore-receipt.json" 'select(.terminalProcessesSha256 == $restore[0].terminalProcessesSha256) + {daemonsOffline:$restore[0].daemonsOffline,runnerOffline:$restore[0].runnerOffline}' "$observation"); write_receipt "$directory/root-runtime.json" "$runtime"; write_receipt "$directory/root-runtime.sha256" "$(digest "$directory/root-runtime.json")"; root_mode "$directory/root-runtime.json" 600 && root_mode "$directory/root-runtime.sha256" 600 && [ "$(/bin/cat "$directory/root-runtime.sha256")" = "$(digest "$directory/root-runtime.json")" ]; }
write_pre_release_terminal() { directory=$1; proof=$(/usr/bin/jq -cS -n --arg admission "$(/usr/bin/jq -er .admissionId "$directory/binding.json")" --arg campaign "$campaign_id" --argjson attempt "$(/usr/bin/jq -er .run.attempt "$directory/binding.json")" --argjson run "$(/usr/bin/jq -er .run.id "$directory/binding.json")" --argjson state "$(/usr/bin/jq -er .stateGeneration "$directory/abort-trigger.json")" '{admissionId:$admission,attempt:$attempt,campaignId:$campaign,kind:"pre-release-abort",runId:$run,schemaVersion:1,stateGeneration:$state}'); write_receipt "$directory/pre-release-abort.json" "$proof"; root_mode "$directory/pre-release-abort.json" 600; }
write_pre_release_runtime() { directory=$1; runtime=$(/usr/bin/jq -cS --slurpfile proof "$directory/pre-release-abort.json" --slurpfile restore "$directory/restore-receipt.json" '$proof[0] + {daemonsOffline:$restore[0].daemonsOffline,runnerOffline:$restore[0].runnerOffline,terminalProcessesSha256:$restore[0].terminalProcessesSha256}'); write_receipt "$directory/root-runtime.json" "$runtime"; write_receipt "$directory/root-runtime.sha256" "$(digest "$directory/root-runtime.json")"; root_mode "$directory/root-runtime.json" 600 && root_mode "$directory/root-runtime.sha256" 600 && [ "$(/bin/cat "$directory/root-runtime.sha256")" = "$(digest "$directory/root-runtime.json")" ]; }
validate_terminal_trigger() { directory=$1; canonical=$(canonical_json "$directory/abort-trigger.json"); [ "$(/bin/cat "$directory/abort-trigger.json")" = "$canonical" ] && /usr/bin/jq -er --arg admission "$(/usr/bin/jq -er .admissionId "$directory/binding.json")" --arg binding "$(digest "$directory/binding.json")" --arg active "$(/usr/bin/jq -er .controllerBindingSha256 "$ACTIVE_TRANSACTION")" --argjson attempt "$(/usr/bin/jq -er .run.attempt "$directory/binding.json")" --argjson run "$(/usr/bin/jq -er .run.id "$directory/binding.json")" 'select(keys == ["admissionId","attempt","runId","schemaVersion","stateGeneration"] and $binding == $active and .schemaVersion == 1 and .admissionId == $admission and .attempt == $attempt and .runId == $run and (.stateGeneration|type == "number" and floor == . and . >= 1)) | .stateGeneration' "$directory/abort-trigger.json"; }
verify_campaign_restored() { restored="$STATE_ROOT/$campaign_id/restored.json"; root_mode "$restored" 600 && [ "$(canonical_json "$restored")" = "$(/usr/bin/tr -d '\n' <"$restored")" ] && /usr/bin/jq -e --arg capture "$capture_sha" --arg policy "$(digest "$POLICY")" 'keys == ["captureSha256","mode","policyFileSha256","progress","reconciled","residualState","schemaVersion","sourceDigest"] and .schemaVersion == 1 and .mode == "campaign" and .captureSha256 == $capture and .policyFileSha256 == $policy and .reconciled == true and (.sourceDigest|test("^[a-f0-9]{64}$")) and (.residualState|keys == ["accountingTablePresent","cronSha256","dedicatedNetworkPresent","dedicatedServicesActive","ownedFirewallPresent","samplerActive","transactionContainerCount"]) and .residualState.accountingTablePresent == false and .residualState.dedicatedNetworkPresent == false and .residualState.dedicatedServicesActive == false and .residualState.ownedFirewallPresent == false and .residualState.samplerActive == false and .residualState.transactionContainerCount == 0' "$restored" >/dev/null; }
restore_quiesced_campaign() { [ "$cleanup_phase" = quiesced ] && printf '%s' "$capture_sha" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || return 1; root_mode "$STATE_ROOT/$campaign_id/capture.json" 600 && root_mode "$STATE_ROOT/$campaign_id/capture.sha256" 600 || return 1; [ "$(digest "$STATE_ROOT/$campaign_id/capture.json")" = "$capture_sha" ] && [ "$(/bin/cat "$STATE_ROOT/$campaign_id/capture.sha256")" = "$capture_sha" ] || return 1; failpoint campaign-restore || return 1; verify_campaign_restored || "$SCRIPT_DIR/campaign-restore.sh" "$campaign_id" "$capture_sha" || return 1; verify_campaign_restored; }
restore_transaction() {
  directory=$1 generation=${2-} terminal_sha=${3-}; ACTIVE_TRANSACTION="$directory/active-transaction.json"; verify_active_transaction "$campaign_id" || return 1
  failpoint stop-measurement || return 1; /bin/systemctl stop baci-cwv-measurement.service 2>/dev/null || return 1; failpoint remove-allow || return 1; remove_bound_artifact allow "$ALLOW_ROOT/active.json" || return 1; failpoint remove-inventory || return 1; remove_bound_artifact inventory "$INVENTORY_ROOT/active.json" || return 1; failpoint remove-release || return 1; remove_bound_artifact release "$RELEASE_ROOT/release.json" || return 1; failpoint remove-environment || return 1; remove_bound_artifact environment "$ENV_FILE" || return 1; failpoint remove-sampler-environment || return 1; remove_bound_artifact samplerEnvironment "$SAMPLER_ENV" || return 1
  failpoint stop-sampler || return 1; /bin/systemctl stop baci-cwv-host-sampler.timer 2>/dev/null || return 1; failpoint campaign-restore || return 1; verify_campaign_restored || "$SCRIPT_DIR/campaign-restore.sh" "$campaign_id" "$capture_sha" || return 1; verify_campaign_restored || return 1; [ -z "$generation$terminal_sha" ] || { failpoint restore-receipt || return 1; restore_receipt "$directory" "$generation" "$terminal_sha"; }
}

cleanup() { status=${1:-$?}; trap - EXIT HUP INT TERM; if [ "$cleanup_armed" -eq 1 ]; then case "$cleanup_phase" in quiesced) restore_quiesced_campaign && cleanup_armed=0 || status=1 ;; transaction) restore_transaction "$CONTROL_ROOT/$campaign_id" "$cleanup_generation" "$cleanup_terminal_sha" && cleanup_armed=0 || status=1 ;; *) status=1 ;; esac; fi; exit "$status"; }
trap cleanup EXIT HUP INT TERM
# Closed transition order: validate-admission, campaign-quiesce.sh, install-admission, write-prestart-environment, systemctl start baci-cwv-measurement.service, inspect-held-container, install-classifier, live-sample.json, validate-inventory, release.json, acknowledged.
recover_begin() { directory=$1 staging=$2 boot=$(boot_id) || return 1; [ -d "$directory" ] && [ ! -L "$directory" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory")" = 0:700 ] && root_mode "$directory/binding.json" 600 && root_mode "$directory/admission-challenge.json" 600 || return 1; [ "$(digest "$staging/binding.json")" = "$(digest "$directory/binding.json")" ] || return 1; /usr/bin/jq -e --arg binding "$(digest "$directory/binding.json")" --arg boot "$boot" --arg campaign "$campaign_id" 'keys == ["bindingDigest","bootId","campaignId","createdMonotonicSeconds","deadlineMonotonicSeconds","kind","nonce","schemaVersion"] and .bindingDigest == $binding and .bootId == $boot and .campaignId == $campaign and .kind == "admission" and .schemaVersion == 1 and (.bootId|test("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$")) and (.nonce|test("^[a-f0-9]{64}$")) and (.createdMonotonicSeconds|type == "number") and .deadlineMonotonicSeconds == .createdMonotonicSeconds + 30' "$directory/admission-challenge.json" >/dev/null || return 1; /bin/rm -f -- "$staging/binding.json" || return 1; /bin/rmdir -- "$staging" || return 1; /usr/bin/sync -f "$CONTROL_ROOT" || return 1; /bin/cat "$directory/admission-challenge.json"; }
begin() {
  id=$1
  [ -d "$CONTROL_ROOT" ] && [ ! -L "$CONTROL_ROOT" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$CONTROL_ROOT")" = 0:700 ]
  directory="$CONTROL_ROOT/$id" staging="$CONTROL_ROOT/.$id.begin-$$" archive="$CONTROL_ROOT/$id-attempt-1" marker="$CONTROL_ROOT/$id.rearm.json"
  [ ! -e "$staging" ] || { printf '%s\n' 'campaign staging already exists' >&2; return 73; }
  /usr/bin/install -d -m 0700 -o root -g root "$staging"; /usr/bin/dd of="$staging/binding.json" status=none; /bin/chmod 0600 "$staging/binding.json"; root_file "$staging/binding.json"
  if [ -d "$archive" ]; then root_mode "$marker" 600 && /usr/bin/jq -e --arg sha "$(digest "$staging/binding.json")" '.binding.run.attempt == 2 and .bindingSha256 == $sha and .priorAttempt == 1 and .schemaVersion == 1' "$marker" >/dev/null; else [ ! -e "$marker" ] && /usr/bin/jq -e '.run.attempt == 1' "$staging/binding.json" >/dev/null; fi
  policy_sha=$(digest "$POLICY")
  workflow_path=$(policy /repositoryAuthority/workflowPath)
  workflow_ref=$(policy /repositoryAuthority/workflowRef)
  /usr/bin/jq -e --arg id "$id" --arg policy "$policy_sha" --arg path "$workflow_path" --arg ref "$workflow_ref" '
    keys == ["admissionId","campaignId","expectedSha","policyFileSha256","repository","run","workflow"] and
    .campaignId == $id and (.admissionId|test("^[a-f0-9]{64}$")) and
    (.expectedSha|test("^[a-f0-9]{40}$")) and .policyFileSha256 == $policy and
    .repository == {id:1100488586,name:"ogabasseyy/Baci"} and
    .workflow.path == $path and .workflow.ref == $ref and .workflow.job == "attest"
  ' "$staging/binding.json" >/dev/null
  if [ -e "$directory" ]; then recover_begin "$directory" "$staging"; return; fi
  nonce=$(/usr/bin/openssl rand -hex 32); now=$(monotonic); boot=$(boot_id); admission_ttl=$(policy /repositoryAuthority/admissionChallengeTtlSeconds); [ "$admission_ttl" -eq 30 ]
  /usr/bin/node "$CONTRACT" create-challenge "$staging/binding.json" admission "$nonce" "$now" "$admission_ttl" "$boot" >"$staging/admission-challenge.json"
  /bin/chmod 0600 "$staging/admission-challenge.json"; /usr/bin/sync -f "$staging/binding.json"; /usr/bin/sync -f "$staging"; /bin/mv -T "$staging" "$directory"; /usr/bin/sync -f "$CONTROL_ROOT"; if [ -d "$archive" ]; then /bin/mv -T "$marker" "$directory/rearm-authorization.json"; /usr/bin/sync -f "$directory"; fi; /bin/cat "$directory/admission-challenge.json"
}

inspect_held_container() {
  directory=$1
  ids=$(/usr/bin/docker --host "$SOCKET" ps -q --no-trunc --filter "label=baci.cwv.transaction=$campaign_id")
  [ "$(printf '%s\n' "$ids" | /usr/bin/sed '/^$/d' | /usr/bin/wc -l)" -eq 1 ]
  container_id=$ids
  printf '%s' "$container_id" | /usr/bin/grep -Eq '^[a-f0-9]{64}$'
  /usr/bin/docker --host "$SOCKET" inspect "$container_id" >"$directory/container-inspect.json"
  pid=$(/usr/bin/jq -er '.[0].State.Pid' "$directory/container-inspect.json")
  hostname=$(/usr/bin/jq -er '.[0].Config.Hostname' "$directory/container-inspect.json")
  [ "$hostname" = "$(printf '%s' "$container_id" | /usr/bin/cut -c1-12)" ]
  runner_ip=$(/usr/bin/jq -er '.[0].NetworkSettings.Networks["baci-cwv-net"].IPAddress' "$directory/container-inspect.json")
  host_ifindex=$(/usr/bin/nsenter --target "$pid" --net /bin/cat /sys/class/net/eth0/iflink)
  runner_veth=$(/usr/sbin/ip -o link | /usr/bin/awk -F': ' -v index="$host_ifindex" '$1 == index {sub(/@.*/, "", $2); print $2}')
  printf '%s' "$runner_veth" | /usr/bin/grep -Eq '^[A-Za-z0-9_.-]{1,15}$'
  runner_peer_ifindex=$(/bin/cat "/sys/class/net/$runner_veth/iflink")
  external=$(/usr/bin/jq -er '.externalInterface' "$directory/accounting-base-identity.json")
  external_ifindex=$(/bin/cat "/sys/class/net/$external/ifindex")
  campaign_mark=$(/usr/bin/node "$POLICY_TOOL" campaign-mark "$campaign_id")
  cgroup_path=$(/usr/bin/awk -F: '$1 == "0" { print $3 }' "/proc/$pid/cgroup")
  measurement_cgroup_path=/cwv-measurement.slice/docker-$container_id.scope; [ "$cgroup_path" = "$measurement_cgroup_path" ]
  cpuset=$(/bin/cat "/sys/fs/cgroup$cgroup_path/cpuset.cpus.effective")
  [ "$cpuset" = "$(policy /resources/measurementCpuSet)" ]
  root_file "$PROCESS_MAP"
  process_map_sha=$(digest "$PROCESS_MAP")
  /usr/bin/jq -cS -n --arg campaignId "$campaign_id" --arg runnerContainerId "$container_id" \
    --arg hostname "$hostname" --arg runnerIp "$runner_ip" --arg runnerVeth "$runner_veth" \
    --argjson runnerPeerIfindex "$runner_peer_ifindex" \
    '{campaignId:$campaignId,hostname:$hostname,runnerContainerId:$runnerContainerId,runnerIp:$runnerIp,runnerPeerIfindex:$runnerPeerIfindex,runnerVeth:$runnerVeth}' >"$directory/hold-identity.json"
  /usr/bin/jq -cS -n --arg campaignId "$campaign_id" --arg runnerContainerId "$container_id" \
    --arg runnerIp "$runner_ip" --arg runnerVeth "$runner_veth" --arg externalInterface "$external" \
    --argjson campaignMark "$campaign_mark" --argjson externalIfindex "$external_ifindex" \
    --argjson runnerPeerIfindex "$runner_peer_ifindex" \
    '{campaignId:$campaignId,campaignMark:$campaignMark,externalIfindex:$externalIfindex,externalInterface:$externalInterface,generation:1,runnerContainerId:$runnerContainerId,runnerIp:$runnerIp,runnerPeerIfindex:$runnerPeerIfindex,runnerVeth:$runnerVeth}' >"$directory/runtime-identity.json"
  /usr/bin/jq -cS -n --arg cgroupPath "$cgroup_path" --arg cpuset "$cpuset" \
    --arg processMapSha256 "$process_map_sha" --arg runnerContainerId "$container_id" \
    '{cgroupPath:$cgroupPath,cpuset:$cpuset,generation:1,processMapSha256:$processMapSha256,runnerContainerId:$runnerContainerId}' >"$directory/process-identity.json"
}

install_classifier() {
  directory=$1
  runner_veth=$(/usr/bin/jq -er .runnerVeth "$directory/hold-identity.json")
  external=$(/usr/bin/jq -er '.externalInterface' "$directory/accounting-base-identity.json")
  family=$(policy /networkAccounting/family); table=$(policy /networkAccounting/table)
  classify=$(policy /networkAccounting/classifyChain); ingress=$(policy /networkAccounting/ingressChain)
  mark=$(/usr/bin/node "$POLICY_TOOL" campaign-mark "$campaign_id"); prefix=$(policy /dedicatedRuntime/ruleCommentPrefix)
  /usr/sbin/nft add rule "$family" "$table" "$classify" iifname "$runner_veth" oifname "$external" ct mark set "$mark" comment "$prefix$campaign_id:classify-measurement"
  /usr/sbin/nft add rule "$family" "$table" "$ingress" iifname "$external" oifname "$runner_veth" ct mark "$mark" counter comment "$prefix$campaign_id:measurement-ingress"
  /usr/sbin/nft -j -a list table "$family" "$table" >"$directory/classifier.json"
  /usr/bin/node "$SCRIPT_DIR/exact-run-accounting.mjs" "$directory/accounting-base-identity.json" \
    "$directory/runtime-identity.json" "$directory/classifier.json" "$campaign_id" >"$directory/accounting-identity.json"
  digest "$directory/accounting-identity.json" >"$directory/classifier.sha256"
}

wait_for_sample() {
  directory=$1
  campaign_directory="$STATE_ROOT/$campaign_id"; expected=$(/usr/bin/jq -cS -n --arg accountingSha "$(digest "$campaign_directory/accounting-identity.json")" --arg campaign "$campaign_id" --arg capture "$(/usr/bin/jq -er .captureSha256 "$ACTIVE_TRANSACTION")" --arg policySha "$(digest "$POLICY")" --slurpfile accounting "$campaign_directory/accounting-identity.json" --slurpfile runtime "$campaign_directory/runtime-identity.json" '{binding:{accountingIdentitySha256:$accountingSha,accountingTable:$accounting[0].table,campaignId:$campaign,campaignMark:$runtime[0].campaignMark,captureSha256:$capture,externalIfindex:$runtime[0].externalIfindex,externalInterface:$runtime[0].externalInterface,generation:$runtime[0].generation,policySha256:$policySha,runnerContainerId:$runtime[0].runnerContainerId,runnerIp:$runtime[0].runnerIp,runnerPeerIfindex:$runtime[0].runnerPeerIfindex,runnerVeth:$runtime[0].runnerVeth},classifierHandle:$accounting[0].handles["classify-measurement"],schemaVersion:1}'); write_receipt "$directory/live-sample-expected.json" "$expected"
  attempt=0
  while [ "$attempt" -lt 15 ]; do
    now=$(/bin/date -u +%s)
    if root_file "$EVIDENCE_ROOT/live-sample.json" && [ "$(/usr/bin/stat -c '%u:%g:%a' -- "$EVIDENCE_ROOT/live-sample.json")" = 0:10001:640 ] && copy_receipt "$EVIDENCE_ROOT/live-sample.json" "$directory/live-sample.json" && root_mode "$directory/live-sample.json" 600 && /usr/bin/node "$LIVE_SAMPLE_CONTRACT" "$directory/live-sample.json" "$directory/live-sample-expected.json" "$now" >/dev/null; then
      digest "$directory/live-sample.json" >"$directory/live-sample.sha256"
      return 0
    fi
    attempt=$((attempt + 1)); /bin/sleep 1
  done
  return 1
}

admit() {
  id=$1 directory="$CONTROL_ROOT/$1" campaign_directory="$STATE_ROOT/$1"
  root_file "$directory/binding.json" && root_file "$directory/admission-challenge.json"
  /usr/bin/dd of="$directory/admission.json" status=none; /bin/chmod 0600 "$directory/admission.json"
  now=$(monotonic); boot=$(boot_id)
  /usr/bin/node "$CONTRACT" validate-admission "$directory/binding.json" "$directory/admission-challenge.json" "$directory/admission.json" "$now" "$boot" >"$directory/admission-receipt.json"
  cleanup_armed=1
  capture_sha=$("$SCRIPT_DIR/campaign-quiesce.sh" campaign "$id")
  cleanup_phase=quiesced
  write_active_transaction "$directory" "$capture_sha"
  cleanup_phase=transaction
  hold_timeout=$(policy /repositoryAuthority/listenerHoldTimeoutSeconds); [ "$hold_timeout" -eq 120 ]
  hold_start=$(monotonic)
  /usr/bin/jq -cS -n --arg campaign "$id" --arg capture "$capture_sha" --argjson start "$hold_start" --argjson deadline "$((hold_start + hold_timeout))" '
    {BACI_CWV_CAMPAIGN_ID:$campaign,BACI_CWV_CAPTURE_SHA256:$capture,
    BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS:$start,
    BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS:$deadline}' >"$directory/prestart.json"
  { printf 'BACI_CWV_CAMPAIGN_ID=%s\n' "$id"; printf 'BACI_CWV_CAPTURE_SHA256=%s\n' "$capture_sha";
    printf 'BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS=%s\n' "$hold_start";
    printf 'BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS=%s\n' "$((hold_start + hold_timeout))"; } >"$directory/measurement.env"
  /bin/chmod 0600 "$directory/measurement.env"; bind_artifact "$directory" environment "$directory/measurement.env"
  /usr/bin/install -o root -g baci-cwv -m 0440 "$directory/measurement.env" "$ENV_FILE"; /usr/bin/sync -f "$ENV_FILE"
  /bin/systemctl start baci-cwv-measurement.service
  inspect_held_container "$campaign_directory"
  install_classifier "$campaign_directory"
  /bin/cp -- "$campaign_directory/classifier.sha256" "$directory/classifier.sha256"
  printf 'BACI_CWV_CAMPAIGN_ID=%s\n' "$id" >"$directory/host-sampler.env"
  /bin/chmod 0600 "$directory/host-sampler.env"; bind_artifact "$directory" samplerEnvironment "$directory/host-sampler.env"
  /usr/bin/install -o root -g root -m 0600 "$directory/host-sampler.env" "$SAMPLER_ENV"; /usr/bin/sync -f "$SAMPLER_ENV"
  /bin/systemctl start baci-cwv-host-sampler.timer
  wait_for_sample "$directory"
  digest "$campaign_directory/hold-identity.json" >"$directory/hold.sha256"
  nonce=$(/usr/bin/openssl rand -hex 32); now=$(monotonic); boot=$(boot_id)
  inventory_ttl=$(policy /repositoryAuthority/inventoryReceiptTtlSeconds); [ "$inventory_ttl" -eq 5 ]
  /usr/bin/node "$CONTRACT" create-challenge "$directory/binding.json" inventory "$nonce" "$now" "$inventory_ttl" "$boot" >"$directory/inventory-challenge.json"
  /usr/bin/jq -cS -n --slurpfile challenge "$directory/inventory-challenge.json" --slurpfile identity "$campaign_directory/hold-identity.json" \
    --arg holdDigest "$(/bin/cat "$directory/hold.sha256")" --arg liveSampleDigest "$(/bin/cat "$directory/live-sample.sha256")" \
    '{challenge:$challenge[0],holdDigest:$holdDigest,identity:$identity[0],liveSampleDigest:$liveSampleDigest,schemaVersion:1}' >"$directory/hold.json"
  /bin/chmod 0600 "$directory"/*.json "$directory"/*.sha256
  cleanup_armed=0; cleanup_phase=idle
  /bin/cat "$directory/hold.json"
}

validate_process_sample() { busy=$(/usr/bin/jq -r '.busy' "$directory/processes.json"); phase=$(/usr/bin/jq -er '.phase' "$directory/processes.json"); /usr/bin/jq -cS '.processes' "$directory/processes.json" >"$directory/process-list.json"; /usr/bin/node "$CONTRACT" validate-process "$phase" "$busy" "$run_id" "$PROCESS_MAP" "$campaign_directory/process-identity.json" "$directory/process-list.json" >/dev/null; }
release() {
  id=$1 directory="$CONTROL_ROOT/$1" campaign_directory="$STATE_ROOT/$1"; ACTIVE_TRANSACTION="$directory/active-transaction.json"; verify_active_transaction "$id" || return 1; controller_timeout=$(policy /repositoryAuthority/controllerTimeoutSeconds); [ "$controller_timeout" -eq 1200 ] || return 1; terminal_deadline=$(( $(monotonic) + controller_timeout )); cleanup_armed=1; cleanup_phase=transaction
  /usr/bin/dd of="$directory/inventory.json" status=none; /bin/chmod 0600 "$directory/inventory.json"
  now=$(monotonic); boot=$(boot_id)
  inventory_ttl=$(policy /repositoryAuthority/inventoryReceiptTtlSeconds); [ "$inventory_ttl" -eq 5 ]
  /usr/bin/node "$CONTRACT" validate-inventory "$directory/binding.json" "$directory/inventory-challenge.json" "$directory/inventory.json" "$directory/hold.sha256" "$SCRIPT_DIR/runner-identity.json" "$now" "$inventory_ttl" "$boot" >"$directory/inventory-receipt.json"
  /usr/bin/node "$CONTRACT" create-final-allow "$directory/binding.json" "$directory/inventory-receipt.json" "$now" >"$directory/allow.json"
  bind_artifact "$directory" allow "$directory/allow.json"
  install_json "$directory/allow.json" "$ALLOW_ROOT/active.json" 0440 baci-cwv
  bind_artifact "$directory" inventory "$directory/inventory-receipt.json"
  install_json "$directory/inventory-receipt.json" "$INVENTORY_ROOT/active.json" 0440 baci-cwv
  now=$(monotonic)
  deadline=$(/usr/bin/jq -er .BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS "$directory/prestart.json"); /usr/bin/node "$CONTRACT" create-normal-release "$directory/binding.json" "$directory/inventory-receipt.json" "$directory/classifier.sha256" "$directory/hold.sha256" "$directory/live-sample.sha256" "$campaign_directory/runtime-identity.json" "$campaign_directory/hold-identity.json" "$(/usr/bin/jq -er .captureSha256 "$ACTIVE_TRANSACTION")" "$now" "$deadline" >"$directory/release.json"
  bind_artifact "$directory" release "$directory/release.json"
  install_json "$directory/release.json" "$RELEASE_ROOT/release.json" 0440 baci-cwv
  printf '%s\n' acknowledged
  run_id=$(/usr/bin/jq -er .run.id "$directory/binding.json")
  while /bin/systemctl is-active --quiet baci-cwv-measurement.service; do before_controller_deadline "$terminal_deadline" || return 1
    /usr/bin/timeout --signal=TERM --kill-after=1s "$((terminal_deadline - $(monotonic)))s" /usr/bin/docker --host "$SOCKET" exec "$(/usr/bin/jq -er .runnerContainerId "$campaign_directory/hold-identity.json")" /opt/runner/externals/node24/bin/node /opt/baci-cwv/process-inventory.mjs >"$directory/processes.json"
    validate_process_sample
    [ "$phase" != terminal ] || return 1
    /bin/sleep 1
  done
  until "$SCRIPT_DIR/exact-run-terminal-cleanup.sh" --observe-terminal "$id" >"$directory/processes.json"; do before_controller_deadline "$terminal_deadline" || return 1; /bin/sleep 1; done
  validate_process_sample
  [ "$phase" = terminal ]
  cleanup_armed=0; cleanup_phase=idle
}

complete_run() {
  id=$1 directory="$CONTROL_ROOT/$1"; ACTIVE_TRANSACTION="$directory/active-transaction.json"; verify_active_transaction "$id"
  cleanup_armed=1; cleanup_phase=transaction
  /usr/bin/dd of="$directory/completion-trigger.json" status=none; /bin/chmod 0600 "$directory/completion-trigger.json"
  canonical=$(canonical_json "$directory/completion-trigger.json"); [ "$(/bin/cat "$directory/completion-trigger.json")" = "$canonical" ] || return 1
  generation=$(/usr/bin/jq -er --arg admission "$(/usr/bin/jq -er .admissionId "$directory/binding.json")" --argjson attempt "$(/usr/bin/jq -er .run.attempt "$directory/binding.json")" --argjson run "$(/usr/bin/jq -er .run.id "$directory/binding.json")" '
    select(keys == ["admissionId","artifactReadbackEvidenceSha256","attempt","ownerEvidenceHandoffSha256","ownerStateSha256","runId","schemaVersion","stateGeneration"] and .schemaVersion == 1 and .admissionId == $admission and .attempt == $attempt and .runId == $run and (.stateGeneration|type == "number" and floor == . and . >= 1) and all([.artifactReadbackEvidenceSha256,.ownerEvidenceHandoffSha256,.ownerStateSha256][]; type == "string" and test("^[a-f0-9]{64}$"))) | .stateGeneration' "$directory/completion-trigger.json")
  [ "$(canonical_json "$directory/process-list.json")" = '[]' ] || return 1
  terminal=$(/usr/bin/jq -cS -n --arg admission "$(/usr/bin/jq -er .admissionId "$directory/binding.json")" --argjson attempt "$(/usr/bin/jq -er .run.attempt "$directory/binding.json")" --arg campaign "$id" --argjson run "$(/usr/bin/jq -er .run.id "$directory/binding.json")" --argjson state "$generation" '{admissionId:$admission,attempt:$attempt,campaignId:$campaign,processes:[],runId:$run,schemaVersion:1,stateGeneration:$state}')
  write_receipt "$directory/terminal-processes.json" "$terminal"; terminal_sha=$(digest "$directory/terminal-processes.json")
  cleanup_generation=$generation; cleanup_terminal_sha=$terminal_sha
  restore_transaction "$directory" "$cleanup_generation" "$cleanup_terminal_sha"; cleanup_armed=0; cleanup_phase=idle; cleanup_generation=; cleanup_terminal_sha=
  /usr/bin/jq -cS -n --slurpfile restore "$directory/restore-receipt.json" --slurpfile terminal "$directory/terminal-processes.json" '{restore:$restore[0],terminal:$terminal[0]}'
}

abort() {
  id=$1 directory="$CONTROL_ROOT/$1" evidence="$TRANSITION_EVIDENCE_ROOT/$1"; ACTIVE_TRANSACTION="$directory/active-transaction.json"; verify_active_transaction "$id"; /usr/bin/dd of="$directory/abort-trigger.json" status=none; /bin/chmod 0600 "$directory/abort-trigger.json"
  cleanup_armed=1; cleanup_phase=transaction
  generation=$(validate_terminal_trigger "$directory")
  if [ "$(/usr/bin/jq -er '.artifacts.release' "$ACTIVE_TRANSACTION")" = null ]; then write_pre_release_terminal "$directory"; cleanup_generation=$generation; cleanup_terminal_sha=$(digest "$directory/pre-release-abort.json"); restore_transaction "$directory" "$cleanup_generation" "$cleanup_terminal_sha"; write_pre_release_runtime "$directory"; cleanup_armed=0; cleanup_phase=idle; cleanup_generation=; cleanup_terminal_sha=; /usr/bin/jq -cS -n --slurpfile restore "$directory/restore-receipt.json" --slurpfile runtime "$directory/root-runtime.json" '{restore:$restore[0],runtime:$runtime[0]}'; return; fi
  [ -d "$evidence" ] && [ ! -L "$evidence" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$evidence")" = 0:700 ] || return 1
  copy_receipt "$RELEASE_ROOT/release.json" "$directory/release-installed.json"; snapshot="$directory/transition-evidence"; /usr/bin/install -d -m 0700 -o root -g root "$snapshot"; for receipt in action-node job-start-hook listener-terminal terminal-processes transition; do root_mode "$evidence/$receipt.json" 600; copy_receipt "$evidence/$receipt.json" "$snapshot/$receipt.json"; done; observation=$(/usr/bin/node "$TRANSITION_CONTRACT" "$directory/binding.json" "$directory/release-installed.json" "$directory/abort-trigger.json" "$snapshot"); write_receipt "$directory/transport-observation.json" "$observation"
  generation=$(/usr/bin/jq -er .stateGeneration "$directory/transport-observation.json"); terminal_sha=$(/usr/bin/jq -er .terminalProcessesSha256 "$directory/transport-observation.json"); cleanup_generation=$generation; cleanup_terminal_sha=$terminal_sha; restore_transaction "$directory" "$cleanup_generation" "$cleanup_terminal_sha"; write_root_runtime "$directory" "$directory/transport-observation.json"; cleanup_armed=0; cleanup_phase=idle; cleanup_generation=; cleanup_terminal_sha=
  /usr/bin/jq -cS -n --slurpfile restore "$directory/restore-receipt.json" --slurpfile runtime "$directory/root-runtime.json" '{restore:$restore[0],runtime:$runtime[0]}'
}

rearm() {
  id=$1 directory="$CONTROL_ROOT/$1" archive="$CONTROL_ROOT/$1-attempt-1" marker="$CONTROL_ROOT/$1.rearm.json" evidence="$CONTROL_ROOT/$1/transition-evidence"
  if [ ! -e "$directory" ] && [ -d "$archive" ] && root_mode "$marker" 600; then /bin/cat "$marker"; return; fi
  [ ! -e "$archive" ] || return 1; verify_active_transaction "$id" || return 1; /usr/bin/jq -e 'all(.artifacts[]; . == null)' "$ACTIVE_TRANSACTION" >/dev/null || return 1
  for receipt in abort-trigger binding release-installed restore-receipt root-runtime transport-observation; do root_mode "$directory/$receipt.json" 600; done
  root_mode "$directory/restore-receipt.sha256" 600 && root_mode "$directory/root-runtime.sha256" 600
  [ "$(/bin/cat "$directory/restore-receipt.sha256")" = "$(digest "$directory/restore-receipt.json")" ] && [ "$(/bin/cat "$directory/root-runtime.sha256")" = "$(digest "$directory/root-runtime.json")" ]
  capture_sha=$(/bin/cat "$STATE_ROOT/$id/capture.sha256"); verify_campaign_restored
  observation=$(/usr/bin/node "$TRANSITION_CONTRACT" "$directory/binding.json" "$directory/release-installed.json" "$directory/abort-trigger.json" "$evidence"); [ "$observation" = "$(/bin/cat "$directory/transport-observation.json")" ]
  /usr/bin/dd of="$directory/rearm-request.json" status=none; /bin/chmod 0600 "$directory/rearm-request.json"; [ "$(canonical_json "$directory/rearm-request.json")" = "$(/bin/cat "$directory/rearm-request.json")" ]
  authorization=$(/usr/bin/node "$REARM_CONTRACT" "$directory/binding.json" "$directory/rearm-request.json" "$directory/root-runtime.json" "$directory/restore-receipt.json" "$directory/transport-observation.json")
  if [ -e "$marker" ]; then root_mode "$marker" 600 && [ "$(/bin/cat "$marker")" = "$authorization" ]; else write_receipt "$marker" "$authorization"; fi
  /bin/mv -T "$directory" "$archive"; /usr/bin/sync -f "$CONTROL_ROOT"; /bin/cat "$marker"
}

[ "$#" -eq 2 ] || usage
mode=$1; campaign_id=$2
printf '%s' "$campaign_id" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$' || usage
[ "$(/usr/bin/id -u)" -eq 0 ] || { printf '%s\n' 'root required' >&2; exit 77; }
ACTIVE_TRANSACTION=$CONTROL_ROOT/$campaign_id/active-transaction.json
case "$mode" in
  --begin) begin "$campaign_id" <&0 ;;
  --admit) admit "$campaign_id" <&0 ;;
  --release) release "$campaign_id" <&0 ;;
  --complete) complete_run "$campaign_id" <&0 ;;
  --abort) abort "$campaign_id" <&0 ;;
  --rearm) rearm "$campaign_id" <&0 ;;
  *) usage ;;
esac
