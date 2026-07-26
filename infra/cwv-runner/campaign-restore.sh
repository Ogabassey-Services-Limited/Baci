#!/bin/sh
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077
SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
readonly SCRIPT_DIR
readonly STATE_ROOT=/srv/baci-cwv/campaigns STATE_TOOL="$SCRIPT_DIR/campaign-state.mjs" POLICY_TOOL="$SCRIPT_DIR/policy.schema.mjs"
readonly POLICY_FILE="$SCRIPT_DIR/policy.json" TERMINAL_CLEANUP="$SCRIPT_DIR/campaign-terminal-cleanup.mjs" PREPARE_ACCEPTANCE="$SCRIPT_DIR/install-prepare-acceptance.mjs" PREPARE_CONTENT_CLEANUP="$SCRIPT_DIR/install-prepare-content-cleanup-cli.mjs" RESTORE_NETWORK="$SCRIPT_DIR/campaign-restore-network.mjs"
readonly OWNERSHIP="$SCRIPT_DIR/campaign-ownership.mjs" SOURCE_CLOSURE="$SCRIPT_DIR/campaign-source-closure.mjs" EXACT_RUN_CLEANUP="$SCRIPT_DIR/exact-run-terminal-cleanup.sh"
usage() { printf '%s\n' 'usage: campaign-restore.sh <transaction-id> <capture-sha256> [--defer-lease-release [terminal-receipt]|--release-lease]' >&2; exit 64; }
[ "$#" -eq 2 ] || [ "$#" -eq 3 ] || [ "$#" -eq 4 ] || usage
transaction_id=$1; capture_sha=$2; terminal_action=${3:-restore}; terminal_receipt=${4:-}
case "$terminal_action" in restore|--defer-lease-release|--release-lease) ;; *) usage ;; esac
[ "$#" -eq 4 ] && [ "$terminal_action" = --defer-lease-release ] || [ "$#" -ne 4 ] || usage
printf '%s' "$transaction_id" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$' || usage
printf '%s' "$capture_sha" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || usage
[ "$(/usr/bin/id -u)" -eq 0 ] || { printf '%s\n' 'root required' >&2; exit 77; }
assert_private_state_directory() { state_dir=$1; [ -d "$state_dir" ] && [ ! -L "$state_dir" ] || { printf '%s\n' 'secure campaign state directory required' >&2; exit 65; }; [ "$(/usr/bin/stat -c '%u:%a' -- "$state_dir")" = 0:700 ] || { printf '%s\n' 'secure campaign state directory required' >&2; exit 65; }; }
hash_file() { /usr/bin/sha256sum "$1" | /usr/bin/cut -d' ' -f1; }
policy() { /usr/bin/node "$POLICY_TOOL" get "$1"; }
assert_private_state_directory "$STATE_ROOT"; mode=$(/usr/bin/node "$STATE_TOOL" verify-capture "$STATE_ROOT" "$transaction_id" "$capture_sha")
case "$mode" in prepare|registration|campaign|rehearsal) ;; *) exit 65 ;; esac
[ "$terminal_action" != restore ] && [ "$mode" != registration ] && exit 65
directory="$STATE_ROOT/$transaction_id"; capture="$directory/capture.json"; assert_private_state_directory "$directory"
exec 8>"$directory/restore.lock"
/usr/bin/flock -n 8 || { printf '%s\n' 'another restore owns this transaction' >&2; exit 75; }
accounting_final_sha='' reconciled_retry=false restored_already=false
if [ -e "$directory/restored.json" ]; then [ -f "$directory/restored.json" ] && [ ! -L "$directory/restored.json" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory/restored.json")" = 0:600 ] || exit 65
  if [ "$(/usr/bin/jq -er .reconciled "$directory/restored.json")" = true ]; then
    if [ "$terminal_action" = --release-lease ]; then reconciled_retry=false; [ ! -e "$directory/restore-post-commit-failed.json" ] || reconciled_retry=true
    elif [ "$terminal_action" = --defer-lease-release ]; then restored_already=true
    else [ -e "$directory/restore-post-commit-failed.json" ] || { printf '%s\n' 'transaction already restored' >&2; exit 73; }; reconciled_retry=true
    fi
  else accounting_final_sha=$(/usr/bin/jq -er --arg mode "$mode" 'if .schemaVersion == 1 and .mode == $mode and .reconciled == false and .phase == "accounting-delete-pending" and (.accountingFinalSha256 | test("^[a-f0-9]{64}$")) then .accountingFinalSha256 else error("invalid") end' "$directory/restored.json") || { printf '%s\n' 'accounting terminal recovery required' >&2; exit 65; }; [ -f "$directory/accounting.final" ] && [ ! -L "$directory/accounting.final" ] && [ "$(hash_file "$directory/accounting.final")" = "$accounting_final_sha" ] || { printf '%s\n' 'accounting terminal recovery required' >&2; exit 65; }; fi
fi
environment_file="$directory/watchdog.env"
if [ -f "$environment_file" ] && [ ! -L "$environment_file" ]; then [ "$(/usr/bin/wc -l <"$environment_file" | /usr/bin/tr -d ' ')" -eq 7 ] || exit 66
  read_field() { /usr/bin/sed -n "s/^$1=//p" "$environment_file"; }; [ "$(read_field TRANSACTION_ID)" = "$transaction_id" ] && [ "$(read_field MODE)" = "$mode" ] && [ "$(read_field CAPTURE_SHA)" = "$capture_sha" ] || exit 66; source_digest=$(read_field SOURCE_DIGEST)
elif [ "$reconciled_retry" = true ] || { [ "$terminal_action" = --release-lease ] && [ -e "$directory/restore-post-commit-failed.json" ]; }; then [ -f "$directory/restore-post-commit-failed.json" ] && [ ! -L "$directory/restore-post-commit-failed.json" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory/restore-post-commit-failed.json")" = 0:600 ] || exit 66; source_digest=$(/usr/bin/jq -er .sourceDigest "$directory/restore-post-commit-failed.json")
else printf '%s\n' 'watchdog environment missing' >&2; exit 66
fi
printf '%s' "$source_digest" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || exit 66
actual_source_digest=$(/usr/bin/node "$SOURCE_CLOSURE" digest "$SCRIPT_DIR")
[ "$source_digest" = "$actual_source_digest" ] || { printf '%s\n' 'source digest mismatch' >&2; exit 66; }
[ -f "$POLICY_FILE" ] && [ ! -L "$POLICY_FILE" ] || { printf '%s\n' 'sealed policy source required' >&2; exit 66; }
policy_file_sha=$(hash_file "$POLICY_FILE")
sealed_policy_sha="$(/usr/bin/dirname "$STATE_ROOT")/sealed/policy.sha256"
[ -f "$sealed_policy_sha" ] && [ ! -L "$sealed_policy_sha" ] || { printf '%s\n' 'sealed policy digest required' >&2; exit 66; }
[ "$(/bin/cat "$sealed_policy_sha")" = "$policy_file_sha" ] || { printf '%s\n' 'policy digest mismatch' >&2; exit 66; }
# shellcheck disable=SC1091
{ . "$SCRIPT_DIR/campaign-restore-post-commit.sh"; . "$SCRIPT_DIR/campaign-restore-terminal-receipt.sh"; }
if [ "${terminal_action:-restore}" = --release-lease ]; then
  [ -f "$directory/restored.json" ] && [ ! -L "$directory/restored.json" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory/restored.json")" = 0:600 ] || exit 65
  stored_terminal=$(/usr/bin/jq -cS .registrationTerminal "$directory/restored.json") || exit 65; valid_deferred_terminal "$stored_terminal" || exit 65
  /usr/bin/jq -e --arg mode "$mode" --arg capture "$capture_sha" --arg policy "$policy_file_sha" --arg source "$source_digest" '.schemaVersion == 1 and .reconciled == true and .mode == $mode and .captureSha256 == $capture and .policyFileSha256 == $policy and .sourceDigest == $source and (.registrationTerminal | type == "object") and (.residualState | keys == ["accountingTablePresent","cronSha256","dedicatedNetworkPresent","dedicatedServicesActive","ownedFirewallPresent","samplerActive","transactionContainerCount"] and .accountingTablePresent == false and .dedicatedNetworkPresent == false and .dedicatedServicesActive == false and .ownedFirewallPresent == false and .samplerActive == false and .transactionContainerCount == 0 and (.cronSha256 | test("^[a-f0-9]{64}$")))' "$directory/restored.json" >/dev/null || exit 65
  if [ "$reconciled_retry" = true ]; then retry_reconciled_cleanup --stop-watchdog; else post_commit_cleanup --stop-watchdog; fi
  exit $?
fi
if [ "${restored_already:-false}" = true ]; then
  stored_terminal=$(/usr/bin/jq -cS .registrationTerminal "$directory/restored.json") || exit 65
  valid_deferred_terminal "$stored_terminal" || exit 65
  [ -z "$terminal_receipt" ] || [ "$terminal_receipt" = "$stored_terminal" ] || exit 65
  exit 0
fi
if [ "${terminal_action:-restore}" = --defer-lease-release ]; then valid_deferred_terminal "$terminal_receipt" || exit 65; fi
if [ "$reconciled_retry" = true ]; then retry_reconciled_cleanup; exit $?; fi
restore_complete=0; progress='{"anomalies":["journal-inspection-unavailable"],"phase":null}'
write_failure_receipt() {
  status=$?
  trap - EXIT HUP INT TERM
  if [ "$restore_complete" -eq 0 ]; then
    temporary="$directory/restore-failed.json.tmp"
    /usr/bin/jq -S -cn --arg mode "$mode" --arg captureSha256 "$capture_sha" \
      --arg policyFileSha256 "$policy_file_sha" --arg sourceDigest "$source_digest" --argjson progress "$progress" \
      '{captureSha256:$captureSha256,mode:$mode,policyFileSha256:$policyFileSha256,progress:$progress,reconciled:false,schemaVersion:1,sourceDigest:$sourceDigest}' >"$temporary" || :
    /bin/chmod 0600 "$temporary" 2>/dev/null || :
    /usr/bin/sync -f "$temporary" 2>/dev/null || :
    /bin/mv -T "$temporary" "$directory/restore-failed.json" 2>/dev/null || :
    /usr/bin/sync -f "$directory" 2>/dev/null || :
  fi
  exit "$status"
}
trap write_failure_receipt EXIT
trap 'exit 129' HUP; trap 'exit 130' INT; trap 'exit 143' TERM
capture_derived_mode=$(/usr/bin/jq -er '.mode' "$capture")
[ "$mode" = "$capture_derived_mode" ] || { printf '%s\n' 'capture-derived-mode mismatch' >&2; exit 65; }
if ! progress=$(/usr/bin/node --input-type=module -e "import('$STATE_TOOL').then(async m=>process.stdout.write(JSON.stringify(await m.inspectProgress({root:'$STATE_ROOT',transactionId:'$transaction_id'}))))"); then progress='{"anomalies":["journal-inspection-unavailable"],"phase":null}'; fi
/usr/bin/node "$STATE_TOOL" phase "$STATE_ROOT" "$transaction_id" restoring
docker_socket=$(policy /dedicatedRuntime/dockerSocket)
containerd_socket=$(policy /dedicatedRuntime/containerdSocket)
docker_network=$(policy /dedicatedRuntime/networkName)
docker_bridge=$(policy /dedicatedRuntime/bridgeName)
docker_service=$(policy /dedicatedRuntime/dockerService)
containerd_service=$(policy /dedicatedRuntime/containerdService)
accounting_family=$(policy /networkAccounting/family)
accounting_table=$(policy /networkAccounting/table)
cron_user=$(policy /host/adminAccount)
suffix=$(printf '%s' "$transaction_id" | /usr/bin/sha256sum | /usr/bin/cut -c1-8)
input_chain="$(policy /dedicatedRuntime/ownedInputChainPrefix)$suffix"
forward_chain="$(policy /dedicatedRuntime/ownedForwardChainPrefix)$suffix"
comment="$(policy /dedicatedRuntime/ruleCommentPrefix)$transaction_id"
remove_owned_containers() {
  [ -S "$docker_socket" ] || return 0
  for entry in "$directory"/journal/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json; do
    [ -f "$entry" ] && [ ! -L "$entry" ] && [ "$(/usr/bin/jq -r .action "$entry")" = registration-container-created ] || continue
    resource=$(/usr/bin/jq -ce .resource "$entry"); printf '%s' "$resource" | /usr/bin/jq -e --arg transaction "$transaction_id" 'keys == ["containerId","imageDigest","name","schemaVersion","transactionId"] and .schemaVersion == 1 and .transactionId == $transaction and (.containerId | test("^[a-f0-9]{64}$")) and (.imageDigest | test("^sha256:[a-f0-9]{64}$")) and (.name | test("^baci-cwv-registration-[a-f0-9]{32}$"))' >/dev/null
    id=$(printf '%s' "$resource" | /usr/bin/jq -er .containerId); observed=$(/usr/bin/docker --host "unix://$docker_socket" inspect "$id" 2>/dev/null) || continue
    printf '%s' "$observed" | /usr/bin/jq -e --argjson receipt "$resource" --arg transaction "$transaction_id" 'length == 1 and .[0].Id == $receipt.containerId and .[0].Name == ("/" + $receipt.name) and .[0].Image == $receipt.imageDigest and .[0].Config.Labels["baci.cwv.transaction"] == $transaction' >/dev/null
    [ "$(/usr/bin/docker --host "unix://$docker_socket" rm -f "$id")" = "$id" ]
  done
}
receipt_has_action() {
  expected_action=$1
  for entry in "$directory"/journal/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json; do
    [ -f "$entry" ] && [ ! -L "$entry" ] && /usr/bin/jq -e --arg action "$expected_action" '.action == $action' "$entry" >/dev/null && return 0
  done
  return 1
}
assert_campaign_ownership() {
  [ "$mode" = campaign ] || return 0
  if [ ! -e "$directory/ownership.json" ]; then
    ! /usr/bin/docker --host "unix://$docker_socket" network inspect "$docker_network" >/dev/null 2>&1 && ! /usr/sbin/nft list table "$accounting_family" "$accounting_table" >/dev/null 2>&1 && ! /usr/sbin/iptables-save | /usr/bin/grep -Fq -e "$comment" -e "$input_chain" -e "$forward_chain"
    return
  fi
  [ -f "$directory/ownership.json" ] && [ ! -L "$directory/ownership.json" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory/ownership.json")" = 0:600 ]
  /usr/bin/node "$RESTORE_NETWORK" ownership "$capture" "$directory/ownership.json" "$transaction_id" "$capture_sha" "$docker_network" "$docker_bridge" "$(policy /dedicatedRuntime/gateway)" "$(policy /dedicatedRuntime/subnet)" "$input_chain" "$forward_chain" "$comment" "$accounting_family" "$accounting_table"
}
stop_measurement() { /bin/systemctl stop baci-cwv-host-sampler.timer 2>/dev/null || :; remove_owned_containers; }
verify_service_empty() {
  service=$1; [ "$(/bin/systemctl show "$service" -p MainPID --value)" = 0 ]; cgroup=$(/bin/systemctl show "$service" -p ControlGroup --value)
  [ -n "$cgroup" ] || return 0
  [ ! -s "/sys/fs/cgroup$cgroup/cgroup.procs" ]
  for shim_pid in $(/usr/bin/pgrep -f 'containerd-shim' 2>/dev/null || :); do
    [ -r "/proc/$shim_pid/cgroup" ] || return 1
    /usr/bin/grep -Fq -- "$cgroup" "/proc/$shim_pid/cgroup" && return 1
  done
  return 0
}
verify_runtime_quiet() { [ ! -S "$docker_socket" ] && [ ! -S "$containerd_socket" ]; for service in "$docker_service" "$containerd_service"; do verify_service_empty "$service"; done; }
remove_accounting() {
  if [ "$mode" = campaign ] && /usr/sbin/nft list table "$accounting_family" "$accounting_table" >/dev/null 2>&1; then
    /usr/sbin/nft -j -a list table "$accounting_family" "$accounting_table" >"$directory/accounting.current.json"; /usr/bin/node "$RESTORE_NETWORK" accounting "$directory/ownership.json" "$directory/accounting.current.json"
    if [ -n "$accounting_final_sha" ]; then /usr/sbin/nft -a list table "$accounting_family" "$accounting_table" >"$directory/accounting.current"; /usr/bin/cmp -s "$directory/accounting.final" "$directory/accounting.current" || { printf '%s\n' 'accounting terminal recovery required' >&2; exit 65; }; /bin/rm -f -- "$directory/accounting.current"; else
      temporary="$directory/accounting.final.tmp"; /usr/sbin/nft -a list table "$accounting_family" "$accounting_table" >"$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$directory/accounting.final"; /usr/bin/sync -f "$directory"; accounting_final_sha=$(hash_file "$directory/accounting.final")
      write_accounting_checkpoint
    fi
    /usr/sbin/nft delete table "$accounting_family" "$accounting_table"
  fi
  ! /usr/sbin/nft list table "$accounting_family" "$accounting_table" >/dev/null 2>&1
}
write_accounting_checkpoint() { temporary="$directory/restored.json.tmp"; /usr/bin/jq -S -cn --arg mode "$mode" --arg captureSha256 "$capture_sha" --arg accountingFinalSha256 "$accounting_final_sha" '{accountingFinalSha256:$accountingFinalSha256,captureSha256:$captureSha256,mode:$mode,phase:"accounting-delete-pending",reconciled:false,schemaVersion:1}' >"$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$directory/restored.json"; /usr/bin/sync -f "$directory"; }
remove_isolation() {
  [ "$mode" = campaign ] || return 0
  [ -e "$directory/ownership.json" ] && /usr/bin/node "$OWNERSHIP" rollback-isolation "$directory/ownership.json"
  /usr/sbin/iptables-save | /usr/bin/grep -Fq -- "$comment" && return 1; /usr/sbin/iptables-save | /usr/bin/grep -Fq -- "$input_chain" && return 1; /usr/sbin/iptables-save | /usr/bin/grep -Fq -- "$forward_chain" && return 1
}
remove_dedicated_runtime() {
  case "$mode" in campaign|registration|prepare) ;; *) return 0 ;; esac
  if [ -S "$docker_socket" ] && /usr/bin/docker --host "unix://$docker_socket" network inspect "$docker_network" >/dev/null 2>&1; then
    [ "$mode" = campaign ] || return 1
    /usr/bin/docker --host "unix://$docker_socket" network inspect "$docker_network" >"$directory/network.current.json"; /usr/bin/node "$RESTORE_NETWORK" network "$directory/ownership.json" "$directory/network.current.json"
    /usr/bin/docker --host "unix://$docker_socket" network rm "$docker_network" >/dev/null
  fi
  for service in "$docker_service" "$containerd_service"; do /bin/systemctl stop "$service" 2>/dev/null || :; done
}
cleanup_prepare_content() {
  [ "$mode" = prepare ] || return 0
  receipt="$directory/prepare-content-roots.json"
  if [ ! -e "$receipt" ]; then
    receipt_has_action start-dedicated-unit && return 1
    return 0
  fi
  prepare_state="/var/lib/baci-cwv/prepare/$transaction_id/prepare-state.json"
  [ -f "$prepare_state" ] && [ ! -L "$prepare_state" ] || return 1
  prepare_phase=$(/usr/bin/jq -er .phase "$prepare_state")
  [ "$prepare_phase" = target-accepted ] && return 0
  verify_runtime_quiet
  /usr/bin/node "$PREPARE_CONTENT_CLEANUP" cleanup "$transaction_id" "$directory"
}
repair_prepare_acceptance() {
  [ "$mode" = prepare ] || return 0
  prepare_directory="/var/lib/baci-cwv/prepare/$transaction_id"
  prepare_state="$prepare_directory/prepare-state.json"
  [ -f "$prepare_state" ] && [ ! -L "$prepare_state" ] || return 1
  [ "$(/usr/bin/jq -er .phase "$prepare_state")" = target-accepted ] || return 0
  /usr/bin/node "$PREPARE_ACCEPTANCE" publish "$prepare_directory" /srv/baci-cwv >/dev/null
}
cleanup_terminal_mode() {
  case "$mode" in registration|prepare) ;; campaign|rehearsal) return 0;; *) return 1;; esac
  for expected in registration-token-created registration-release-created admission-published registration-staging-created prepare-import-created prepare-synthetic-created prepare-target-verified target-accepted registration-release-layout-created registration-token-layout-created; do
    for entry in "$directory"/journal/[0-9][0-9][0-9][0-9][0-9][0-9]-*.json; do
      [ -f "$entry" ] && [ ! -L "$entry" ] && [ "$(/usr/bin/jq -er .action "$entry")" = "$expected" ] || continue
      resource=$(/usr/bin/jq -ce .resource "$entry")
      if [ "$expected" = registration-token-layout-created ]; then target=$(printf '%s' "$resource" | /usr/bin/jq -er '.root + "/" + .relative'); /usr/bin/node "$TERMINAL_CLEANUP" --validate "$expected" "$transaction_id" "$resource"; if /usr/bin/mountpoint -q -- "$target"; then /usr/bin/umount "$target"; fi; fi
      /usr/bin/node "$TERMINAL_CLEANUP" "$expected" "$transaction_id" "$resource"
    done
  done
}
restore_resources() {
  /usr/bin/jq -c '.priorState.resources.slices | reverse[]' "$capture" | while IFS= read -r row; do id=$(printf '%s' "$row" | /usr/bin/jq -er .id); cpus=$(printf '%s' "$row" | /usr/bin/jq -er .allowedCpus); /bin/systemctl set-property --runtime "$id" AllowedCPUs="$cpus"; done
  /usr/bin/jq -c '.priorState.resources.containers | reverse[]' "$capture" | while IFS= read -r row; do
    id=$(printf '%s' "$row" | /usr/bin/jq -er .id); cpuset=$(printf '%s' "$row" | /usr/bin/jq -er .cpuset); running=$(printf '%s' "$row" | /usr/bin/jq -r .running); /usr/bin/docker update --cpuset-cpus "$cpuset" "$id" >/dev/null
    if [ "$running" = true ]; then /usr/bin/docker start "$id" >/dev/null; else /usr/bin/docker stop "$id" >/dev/null 2>&1 || :; fi
  done
  /usr/bin/jq -c '.priorState.resources.timers | reverse[]' "$capture" | while IFS= read -r row; do
    id=$(printf '%s' "$row" | /usr/bin/jq -er .id); active=$(printf '%s' "$row" | /usr/bin/jq -r .active); enabled=$(printf '%s' "$row" | /usr/bin/jq -r .enabled); if [ "$enabled" = true ]; then /bin/systemctl enable "$id" >/dev/null; else /bin/systemctl disable "$id" >/dev/null; fi
    if [ "$active" = true ]; then /bin/systemctl start "$id"; else /bin/systemctl stop "$id" 2>/dev/null || :; fi
  done
  /usr/bin/jq -c '.priorState.resources.runners | reverse[]' "$capture" | while IFS= read -r row; do id=$(printf '%s' "$row" | /usr/bin/jq -er .id); active=$(printf '%s' "$row" | /usr/bin/jq -r .active); if [ "$active" = true ]; then /bin/systemctl start "$id"; else /bin/systemctl stop "$id" 2>/dev/null || :; fi; done
  archive_path=$(/usr/bin/jq -er '.priorState.cron.archivePath' "$capture")
  archive_sha=$(/usr/bin/jq -er '.priorState.cron.archiveSha256' "$capture")
  [ "$archive_path" = "$directory/crontab.before" ] && [ "$(hash_file "$archive_path")" = "$archive_sha" ]
  /usr/bin/crontab -u "$cron_user" "$archive_path"
  cron_active=$(/usr/bin/jq -r '.priorState.cron.serviceActive' "$capture"); cron_enabled=$(/usr/bin/jq -r '.priorState.cron.serviceEnabled' "$capture")
  if [ "$cron_enabled" = true ]; then /bin/systemctl enable cron.service >/dev/null; else /bin/systemctl disable cron.service >/dev/null; fi
  restore_cron_service
}
verify_cron_cgroup() {
  [ -z "$cron_cgroup" ] && return 0; [ -r "$cron_procs" ] || return 1
  if [ "$cron_active" = false ]; then [ ! -s "$cron_procs" ]; return; fi
  [ -s "$cron_procs" ] || return 1
  while IFS= read -r pid; do [ -r "/proc/$pid/status" ] || return 1; state=$(/usr/bin/sed -n 's/^State:[[:space:]]*\([A-Za-z]\).*/\1/p' "/proc/$pid/status"); case "$state" in R|S|D|I) ;; *) return 1;; esac; done <"$cron_procs"
}
restore_cron_service() { cron_cgroup=$(/bin/systemctl show cron.service -p ControlGroup --value); cron_procs="/sys/fs/cgroup$cron_cgroup/cgroup.procs"; [ -z "$cron_cgroup" ] || [ ! -s "$cron_procs" ] || /bin/systemctl kill --kill-who=all --signal=CONT cron.service; if [ "$cron_active" = true ]; then /bin/systemctl restart cron.service; else /bin/systemctl stop cron.service 2>/dev/null || :; fi; verify_cron_cgroup; }
assert_equal() { [ "$1" = "$2" ] || return 1; }
verify_resource_state() {
  /usr/bin/jq -c '.priorState.resources.slices[]' "$capture" | while IFS= read -r row; do
    id=$(printf '%s' "$row" | /usr/bin/jq -er .id); expected=$(printf '%s' "$row" | /usr/bin/jq -er .allowedCpus)
    [ "$(/bin/systemctl show "$id" -p AllowedCPUs --value)" = "$expected" ]
  done
  /usr/bin/jq -c '.priorState.resources.containers[]' "$capture" | while IFS= read -r row; do
    id=$(printf '%s' "$row" | /usr/bin/jq -er .id); cpuset=$(printf '%s' "$row" | /usr/bin/jq -er .cpuset); running=$(printf '%s' "$row" | /usr/bin/jq -r .running)
    [ "$(/usr/bin/docker inspect --format '{{.HostConfig.CpusetCpus}} {{.State.Running}}' "$id")" = "$cpuset $running" ]
  done
  /usr/bin/jq -c '.priorState.resources.timers[]' "$capture" | while IFS= read -r row; do
    id=$(printf '%s' "$row" | /usr/bin/jq -er .id); expected_active=$(printf '%s' "$row" | /usr/bin/jq -r .active); expected_enabled=$(printf '%s' "$row" | /usr/bin/jq -r .enabled)
    actual_active=false; /bin/systemctl is-active --quiet "$id" && actual_active=true
    actual_enabled=false; /bin/systemctl is-enabled --quiet "$id" && actual_enabled=true
    assert_equal "$actual_active" "$expected_active"
    assert_equal "$actual_enabled" "$expected_enabled"
  done
  /usr/bin/jq -c '.priorState.resources.runners[]' "$capture" | while IFS= read -r row; do
    id=$(printf '%s' "$row" | /usr/bin/jq -er .id); expected=$(printf '%s' "$row" | /usr/bin/jq -r .active)
    actual=false; /bin/systemctl is-active --quiet "$id" && actual=true
    [ "$actual" = "$expected" ]
  done
  expected_active=$(/usr/bin/jq -r '.priorState.cron.serviceActive' "$capture"); expected_enabled=$(/usr/bin/jq -r '.priorState.cron.serviceEnabled' "$capture")
  actual_active=false; /bin/systemctl is-active --quiet cron.service && actual_active=true
  actual_enabled=false; /bin/systemctl is-enabled --quiet cron.service && actual_enabled=true
  assert_equal "$actual_active" "$expected_active"
  assert_equal "$actual_enabled" "$expected_enabled"
}
verify_restored() {
  expected_cron=$(/usr/bin/jq -er '.priorState.cron.sha256' "$capture")
  actual_cron_file=$(/usr/bin/mktemp "$directory/crontab.verify.XXXXXX")
  /usr/bin/crontab -u "$cron_user" -l >"$actual_cron_file" 2>/dev/null || :
  cron_sha=$(hash_file "$actual_cron_file"); /bin/rm -f -- "$actual_cron_file"
  [ "$cron_sha" = "$expected_cron" ]
  [ "$(/bin/cat /proc/sys/net/ipv4/ip_forward)" = "$(/usr/bin/jq -r '.priorState.network.ipForward' "$capture")" ]
  transaction_container_count=0
  dedicated_network_present=false
  if [ -S "$docker_socket" ]; then
    transaction_container_count=$(/usr/bin/docker --host "unix://$docker_socket" ps -aq --filter label=baci.cwv.transaction="$transaction_id" | /usr/bin/sed '/^$/d' | /usr/bin/wc -l | /usr/bin/tr -d ' ')
    /usr/bin/docker --host "unix://$docker_socket" network inspect "$docker_network" >/dev/null 2>&1 && dedicated_network_present=true
  fi
  verify_runtime_quiet
  [ "$transaction_container_count" -eq 0 ] && [ "$dedicated_network_present" = false ]
  if /usr/sbin/ip link show dev "$docker_bridge" >/dev/null 2>&1; then return 1; fi
  accounting_table_present=false; /usr/sbin/nft list table "$accounting_family" "$accounting_table" >/dev/null 2>&1 && accounting_table_present=true
  [ "$accounting_table_present" = false ]
  owned_firewall_present=false
  case "$mode" in campaign|registration)
    /usr/sbin/iptables-save | /usr/bin/grep -Fq -- "$comment" && owned_firewall_present=true
    /usr/sbin/iptables-save | /usr/bin/grep -Fq -- "$input_chain" && owned_firewall_present=true
    /usr/sbin/iptables-save | /usr/bin/grep -Fq -- "$forward_chain" && owned_firewall_present=true
  esac
  [ "$owned_firewall_present" = false ]
  sampler_active=false; /bin/systemctl is-active --quiet baci-cwv-host-sampler.timer && sampler_active=true
  dedicated_services_active=false
  /bin/systemctl is-active --quiet "$docker_service" && dedicated_services_active=true
  /bin/systemctl is-active --quiet "$containerd_service" && dedicated_services_active=true
  [ "$sampler_active" = false ] && [ "$dedicated_services_active" = false ]
  [ "$mode" != campaign ] || /usr/bin/node "$RESTORE_NETWORK" baseline "$capture" "$directory/network-baseline"
  verify_resource_state
}
[ "$mode" != campaign ] || "$EXACT_RUN_CLEANUP" "$transaction_id"; stop_measurement; assert_campaign_ownership; remove_accounting; remove_isolation; remove_dedicated_runtime
cleanup_prepare_content; repair_prepare_acceptance; restore_resources; cleanup_terminal_mode; verify_restored
/usr/bin/node "$STATE_TOOL" phase "$STATE_ROOT" "$transaction_id" restored
restored=$(/usr/bin/jq -S -cn --arg mode "$mode" --arg captureSha256 "$capture_sha" --arg policyFileSha256 "$policy_file_sha" --arg accountingFinalSha256 "$accounting_final_sha" --argjson registrationTerminal "${terminal_receipt:-null}" \
  --arg sourceDigest "$source_digest" --arg cronSha256 "$cron_sha" --argjson progress "$progress" --argjson accountingTablePresent "$accounting_table_present" --argjson transactionContainerCount "$transaction_container_count" --argjson dedicatedNetworkPresent "$dedicated_network_present" --argjson dedicatedServicesActive "$dedicated_services_active" --argjson ownedFirewallPresent "$owned_firewall_present" --argjson samplerActive "$sampler_active" \
  '{captureSha256:$captureSha256,mode:$mode,policyFileSha256:$policyFileSha256,progress:$progress,reconciled:true,residualState:{accountingTablePresent:$accountingTablePresent,cronSha256:$cronSha256,dedicatedNetworkPresent:$dedicatedNetworkPresent,dedicatedServicesActive:$dedicatedServicesActive,ownedFirewallPresent:$ownedFirewallPresent,samplerActive:$samplerActive,transactionContainerCount:$transactionContainerCount},schemaVersion:1,sourceDigest:$sourceDigest} + (if $registrationTerminal == null then {} else {registrationTerminal:$registrationTerminal} end) + (if $accountingFinalSha256 == "" then {} else {accountingFinalSha256:$accountingFinalSha256} end)')
temporary="$directory/restored.json.tmp"
/bin/rm -f -- "$directory/restore-failed.json"
printf '%s\n' "$restored" >"$temporary"; /bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"
/bin/mv -T "$temporary" "$directory/restored.json"; /usr/bin/sync -f "$directory"
restore_complete=1
trap - EXIT HUP INT TERM
if [ "$terminal_action" = --defer-lease-release ]; then exit 0; fi
post_commit_cleanup
