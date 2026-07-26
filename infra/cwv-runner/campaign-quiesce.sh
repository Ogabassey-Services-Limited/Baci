#!/bin/sh
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077
SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
STATE_ROOT=/srv/baci-cwv/campaigns; STATE_TOOL="$SCRIPT_DIR/campaign-state.mjs"; POLICY_TOOL="$SCRIPT_DIR/policy.schema.mjs"
RESTORE="$SCRIPT_DIR/campaign-restore.sh"; LEASE_HOLDER="$SCRIPT_DIR/campaign-lease-holder.sh"; SOURCE_CLOSURE="$SCRIPT_DIR/campaign-source-closure.mjs"; OWNERSHIP="$SCRIPT_DIR/campaign-ownership.mjs"; NETWORK_CONTRACT="$SCRIPT_DIR/campaign-network-contract.mjs"; CAPTURE_AUTHORITY="$SCRIPT_DIR/campaign-capture-authority.mjs"; ACCOUNTING_CONTRACT="$SCRIPT_DIR/campaign-accounting-contract.mjs"; CRON_CONTRACT="$SCRIPT_DIR/campaign-cron-tree.mjs"
LOCK=/run/lock/baci-cwv-campaign.lock; POST_CRON_SHA=603d5005ad4f7b7d8c535be7ac8b8379b69a83b550014a56b2dfa6bbdb51ba8f
readonly SCRIPT_DIR STATE_ROOT STATE_TOOL POLICY_TOOL RESTORE LEASE_HOLDER SOURCE_CLOSURE OWNERSHIP NETWORK_CONTRACT CAPTURE_AUTHORITY ACCOUNTING_CONTRACT CRON_CONTRACT LOCK POST_CRON_SHA
usage() { printf '%s\n' 'usage: campaign-quiesce.sh <prepare|registration|campaign|rehearsal> <transaction-id>' >&2; exit 64; }
[ "$#" -eq 2 ] || usage; mode=$1 transaction_id=$2
case "$mode" in prepare|registration|campaign|rehearsal) ;; *) usage ;; esac
printf '%s' "$transaction_id" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$' || usage
[ "$(/usr/bin/id -u)" -eq 0 ] || { printf '%s\n' 'root required' >&2; exit 77; }
assert_private_state_directory() { state_dir=$1; [ -d "$state_dir" ] && [ ! -L "$state_dir" ] || { printf '%s\n' 'secure campaign state directory required' >&2; exit 65; }; [ "$(/usr/bin/stat -c '%u:%a' -- "$state_dir")" = 0:700 ] || { printf '%s\n' 'secure campaign state directory required' >&2; exit 65; }; }
assert_private_state_directory "$STATE_ROOT"
capture_sha='' restore_armed=0 temporary=''
restore_on_exit() { status=${1:-$?}; trap - EXIT HUP INT TERM; [ -z "$temporary" ] || /bin/rm -rf -- "$temporary"; if [ "$restore_armed" -eq 1 ] && [ -n "$capture_sha" ]; then "$RESTORE" "$transaction_id" "$capture_sha" || status=1; fi; exit "$status"; }
trap restore_on_exit EXIT HUP INT TERM
exec 9>"$LOCK"; /usr/bin/flock -n 9 || { printf '%s\n' 'another campaign holds the lock' >&2; exit 75; }
lock_identity=$(/usr/bin/stat -c '%d:%i' -- "$LOCK")
readonly INVENTORY="$SCRIPT_DIR/cron-inventory.json"
[ "$(/usr/bin/jq -er '.reviewStatus' "$INVENTORY")" = approved ] || { printf '%s\n' 'cron inventory requires privileged scan and review' >&2; exit 78; }
temporary=$(/usr/bin/mktemp -d /run/baci-cwv-capture.XXXXXX)
hash_file() { /usr/bin/sha256sum "$1" | /usr/bin/cut -d' ' -f1; }; policy() { /usr/bin/node "$POLICY_TOOL" get "$1"; }
measurement_cpu_set=$(policy /resources/measurementCpuSet); other_cpu_set=$(policy /resources/otherCpuSet)
journal() { /usr/bin/node "$STATE_TOOL" journal "$STATE_ROOT" "$transaction_id" "$1" "$2" >/dev/null; }
ownership() { command=$1; shift; /usr/bin/node "$OWNERSHIP" "$command" "$STATE_ROOT/$transaction_id/ownership.json" "$@"; }
owned_iptables_mutation() { step=$1; shift; ownership isolation-intent "$step" "$@"; /usr/sbin/iptables "$@"; /usr/sbin/iptables-save >"$temporary/isolation-progress.readback"; ownership isolation-applied "$step" "$temporary/isolation-progress.readback"; }
fail() { printf '%s\n' "$1" >&2; exit 65; }
verify_cron_inventory() { /usr/bin/jq -r '.activeCrontabLines[]' "$INVENTORY" | /usr/bin/sort -u >"$temporary/inventory-cron-lines"; /usr/bin/sed '/^[[:space:]]*#/d;/^[[:space:]]*$/d' "$temporary/crontab" | /usr/bin/sort -u >"$temporary/active-cron-lines"; /usr/bin/cmp -s "$temporary/active-cron-lines" "$temporary/inventory-cron-lines" || fail 'cron inventory does not cover each active line'; }
cron_tuple() {
  pid=$1; [ -r "/proc/$pid/stat" ] && [ -r "/proc/$pid/cmdline" ] || return 1
  fields=$(/usr/bin/awk '{sub(/^.*\) /, ""); print $2 ":" $20}' "/proc/$pid/stat")
  ppid=${fields%%:*}; start_time=${fields#*:}; command=$(/usr/bin/tr '\000\n' '  ' <"/proc/$pid/cmdline")
  [ -n "$ppid" ] && [ -n "$start_time" ] && [ -n "$command" ] || return 1
  printf '%s:%s:%s\n' "$ppid" "$start_time" "$(printf '%s' "$command" | /usr/bin/sha256sum | /usr/bin/cut -d' ' -f1)"
}
collect_cron_trees() {
  output=$1; review=${2:-true}; : >"$temporary/cron-tree.ndjson"; : >"$temporary/cron-frontier"
  cron_pid=$(/bin/systemctl show cron.service -p MainPID --value); case "$cron_pid" in ''|0) /usr/bin/jq -n '[]' >"$output"; return;; *[!0-9]*) fail 'cron process identity invalid';; esac
  cron_tuple=$(cron_tuple "$cron_pid") || fail 'cron process identity unavailable'; cron_start=${cron_tuple#*:}; cron_start=${cron_start%%:*}
  /usr/bin/pgrep -P "$cron_pid" >"$temporary/cron-children" || :
  while IFS= read -r pid; do [ -n "$pid" ] && printf '%s %s %s %s\n' "$pid" "$pid" 0 "$cron_pid" >>"$temporary/cron-frontier"; done <"$temporary/cron-children"
  while [ -s "$temporary/cron-frontier" ]; do
    : >"$temporary/cron-next"; while IFS=' ' read -r pid root depth parent; do
      tuple=$(cron_tuple "$pid") || fail 'cron process replacement'; ppid=${tuple%%:*}; rest=${tuple#*:}; start=${rest%%:*}; command_sha=${rest#*:}; parent_tuple=$(cron_tuple "$parent") || fail 'cron process ancestry unavailable'; parent_start=${parent_tuple#*:}; parent_start=${parent_start%%:*}
      [ "$ppid" = "$parent" ] || fail 'cron process reparented'; /usr/bin/jq -cn --argjson pid "$pid" --argjson ppid "$ppid" --argjson start "$start" --argjson parentStart "$parent_start" --arg commandSha "$command_sha" --argjson root "$root" --argjson depth "$depth" '{pid:$pid,ppid:$ppid,startTime:$start,parentStartTime:$parentStart,commandSha256:$commandSha,rootPid:$root,depth:$depth}' >>"$temporary/cron-tree.ndjson"
      /usr/bin/pgrep -P "$pid" >"$temporary/cron-children" || :; while IFS= read -r child; do [ -n "$child" ] && printf '%s %s %s %s\n' "$child" "$root" "$((depth + 1))" "$pid" >>"$temporary/cron-next"; done <"$temporary/cron-children"
    done <"$temporary/cron-frontier"; /bin/mv -f -- "$temporary/cron-next" "$temporary/cron-frontier"
  done
  /usr/bin/jq -s '[group_by(.rootPid)[]|sort_by(.depth,.pid)]|sort_by(.[0].rootPid)' "$temporary/cron-tree.ndjson" >"$output"
  /usr/bin/jq -e '.activeCronProcessTrees|type == "array" and all(.[]; type == "array" and all(.[]; keys == ["commandSha256","depth","parentStartTime","pid","ppid","rootPid","startTime"] and (.pid,.ppid,.startTime,.parentStartTime,.rootPid,.depth|type == "number") and (.commandSha256|test("^[a-f0-9]{64}$"))))' "$INVENTORY" >/dev/null || fail 'cron tree inventory malformed'
  if [ "$review" = true ]; then /usr/bin/jq -S . "$output" >"$temporary/cron-tree.actual"; /usr/bin/jq -S .activeCronProcessTrees "$INVENTORY" >"$temporary/cron-tree.expected"; /usr/bin/cmp -s "$temporary/cron-tree.actual" "$temporary/cron-tree.expected" || fail 'cron process tree is not reviewed'; fi
}
capture_cron_trees() { collect_cron_trees "$temporary/cron-tree-records.json"; journal capture-cron-trees "$(/bin/cat "$temporary/cron-tree-records.json")"; }
verify_cron_trees() { collect_cron_trees "$temporary/cron-tree-current.json"; /usr/bin/cmp -s "$temporary/cron-tree-records.json" "$temporary/cron-tree-current.json" || fail 'cron process tree drift'; }
assert_captured_cron_identity() {
  row=$1; pid=$(printf '%s' "$row" | /usr/bin/jq -er .pid); expected_start=$(printf '%s' "$row" | /usr/bin/jq -er .startTime); expected_command=$(printf '%s' "$row" | /usr/bin/jq -er .commandSha256); expected_parent=$(printf '%s' "$row" | /usr/bin/jq -er .ppid)
  [ -d "/proc/$pid" ] || return 1; tuple=$(cron_tuple "$pid") || fail 'cron process replacement'; actual_parent=${tuple%%:*}; rest=${tuple#*:}; actual_start=${rest%%:*}; actual_command=${rest#*:}
  [ "$actual_start:$actual_command" = "$expected_start:$expected_command" ] || fail 'cron process replacement'; [ "$actual_parent" = "$expected_parent" ] || [ "$actual_parent" = 1 ] || fail 'cron process reparented'
}
freeze_cron_tree() {
  previous="$temporary/cron-tree-records.json"; attempt=0
  while :; do
    attempt=$((attempt + 1)); [ "$attempt" -le 3 ] || fail 'cron process tree did not freeze'
    /bin/systemctl kill --kill-who=all --signal=STOP cron.service; journal freeze-cron-tree cron.service
    collect_cron_trees "$temporary/cron-tree-candidate.json" false
    /usr/bin/node "$CRON_CONTRACT" merge "$temporary/cron-tree-records.json" "$temporary/cron-tree-candidate.json" >"$temporary/cron-tree-final.json"
    /usr/bin/cmp -s "$previous" "$temporary/cron-tree-final.json" && break
    /bin/cp "$temporary/cron-tree-final.json" "$temporary/cron-tree-stable.json"; previous="$temporary/cron-tree-stable.json"
  done
}
snapshot_resources() {
  /bin/systemctl list-units --type=service --all --no-legend --no-pager | /usr/bin/awk '/actions\.runner\./ {print $1}' | /usr/bin/sort -u >"$temporary/runner-units"
  /usr/bin/pgrep -a -f 'Runner\.Listener|Runner\.Worker' >"$temporary/runner-processes" || :
  : >"$temporary/runners.ndjson"
  while IFS= read -r unit; do [ -n "$unit" ] || continue; active=false; /bin/systemctl is-active --quiet "$unit" && active=true; root=$(/bin/systemctl show "$unit" -p WorkingDirectory --value); [ -n "$root" ] || fail "runner without root: $unit"; /usr/bin/jq -cn --arg id "$unit" --arg root "$root" --argjson active "$active" '{id:$id,active:$active,runnerRoot:$root}' >>"$temporary/runners.ndjson"; done <"$temporary/runner-units"
  while IFS= read -r process; do [ -z "$process" ] && continue; pid=${process%% *}; [ -r "/proc/$pid/cgroup" ] || fail 'runner cgroup missing'; unit=$(/usr/bin/sed -n 's|.*\/\([^/]*\.service\)$|\1|p' "/proc/$pid/cgroup" | /usr/bin/head -1); case "$unit" in '') fail 'unowned Runner.Worker process';; *) /usr/bin/grep -Fxq -- "$unit" "$temporary/runner-units" || fail 'unowned Runner.Worker process';; esac; done <"$temporary/runner-processes"
  /bin/systemctl list-units --type=timer --state=active --no-legend --no-pager | /usr/bin/awk '{print $1}' | /usr/bin/sort -u >"$temporary/timer-units"
  : >"$temporary/timers.ndjson"
  while IFS= read -r unit; do [ -n "$unit" ] || continue; enabled=false; /bin/systemctl is-enabled --quiet "$unit" && enabled=true; /usr/bin/jq -cn --arg id "$unit" --argjson enabled "$enabled" '{id:$id,active:true,enabled:$enabled}' >>"$temporary/timers.ndjson"; done <"$temporary/timer-units"
  /usr/bin/docker ps -aq --no-trunc | /usr/bin/sort -u >"$temporary/container-ids"
  : >"$temporary/containers.ndjson"
  while IFS= read -r id; do [ -n "$id" ] || continue; /usr/bin/docker inspect "$id" >"$temporary/container.json"; /usr/bin/jq -c '.[0] | {id:.Id,running:.State.Running,cpuset:(.HostConfig.CpusetCpus // ""),role:(if .Name == "/autoheal" then "autoheal" else "application" end)}' "$temporary/container.json" >>"$temporary/containers.ndjson"; done <"$temporary/container-ids"
  : >"$temporary/slices.ndjson"; for unit in cwv-measurement.slice system.slice user.slice machine.slice; do cpus=$(/bin/systemctl show "$unit" -p AllowedCPUs --value); /usr/bin/jq -cn --arg id "$unit" --arg cpus "$cpus" '{id:$id,allowedCpus:$cpus}' >>"$temporary/slices.ndjson"; done
  for name in runners timers containers slices; do /usr/bin/jq -s . "$temporary/$name.ndjson" >"$temporary/$name.json"; done
}
snapshot_registration_service_uids() {
  /bin/systemctl list-units --type=service --state=active --no-legend --no-pager | /usr/bin/awk '{print $1}' | /usr/bin/sort -u >"$temporary/active-service-units"
  : >"$temporary/services.ndjson"
  while IFS= read -r unit; do
    [ -n "$unit" ] || continue
    pid=$(/bin/systemctl show "$unit" -p MainPID --value)
    case "$pid" in
      ''|0) service_user=$(/bin/systemctl show "$unit" -p User --value); case "$service_user" in '') uid=0;; *) uid=$(/usr/bin/id -u -- "$service_user") || fail "service uid unavailable: $unit";; esac;;
      *[!0-9]*) fail "service pid invalid: $unit";;
      *) [ -r "/proc/$pid/status" ] || fail "service uid unavailable: $unit"; uid=$(/usr/bin/awk '/^Uid:/ {print $2}' "/proc/$pid/status");;
    esac
    printf '%s' "$uid" | /usr/bin/grep -Eq '^[0-9]+$' || fail "service uid invalid: $unit"
    /usr/bin/jq -cn --arg unit "$unit" --argjson uid "$uid" '{unit:$unit,uid:$uid}' >>"$temporary/services.ndjson"
  done <"$temporary/active-service-units"
  /usr/bin/jq -s . "$temporary/services.ndjson" >"$temporary/services.json"
}
snapshot_network() {
  [ "$(/bin/cat /proc/sys/net/ipv4/ip_forward)" = 1 ] || { printf '%s\n' 'ip_forward must equal 1' >&2; return 1; }
  /usr/sbin/nft list ruleset >"$temporary/nftables"; /usr/sbin/iptables-save >"$temporary/iptables"; /usr/sbin/ip6tables-save >"$temporary/ip6tables"; /usr/sbin/ip -json -4 rule show >"$temporary/ipRules4"; /usr/sbin/ip -json -6 rule show >"$temporary/ipRules6"
  /usr/sbin/ip -json address show >"$temporary/addresses"; /usr/sbin/ip -json route show table all >"$temporary/routes"
  /usr/bin/docker network ls -q >"$temporary/dockerNetworkIds.raw" || return 1; /usr/bin/sort -u "$temporary/dockerNetworkIds.raw" >"$temporary/dockerNetworkIds" || return 1
  /bin/rm -f -- "$temporary/dockerNetworks"; : >"$temporary/dockerNetworks.complete"; while IFS= read -r network_id || [ -n "$network_id" ]; do [ -z "$network_id" ] || /usr/bin/docker network inspect "$network_id" >>"$temporary/dockerNetworks.complete" || { /bin/rm -f -- "$temporary/dockerNetworks.complete"; return 1; }; done <"$temporary/dockerNetworkIds"
  /bin/mv -- "$temporary/dockerNetworks.complete" "$temporary/dockerNetworks" || return 1; : >"$temporary/tc"
  /usr/sbin/ip -o link show | /usr/bin/cut -d: -f2 | /usr/bin/tr -d ' ' | while IFS= read -r interface; do /usr/sbin/tc -json filter show dev "$interface" ingress >>"$temporary/tc"; /usr/sbin/tc -json filter show dev "$interface" egress >>"$temporary/tc"; done
  [ -r /proc/net/nf_conntrack ] || { printf '%s\n' 'conntrack inventory unavailable' >&2; return 1; }; /bin/cat /proc/net/nf_conntrack >"$temporary/conntrack"; /usr/sbin/ip -json route get 1.1.1.1 >"$temporary/default-route"
  external_name=$(/usr/bin/jq -er '.[0].dev' "$temporary/default-route"); external_ifindex=$(/usr/sbin/ip -json link show dev "$external_name" | /usr/bin/jq -er '.[0].ifindex')
  campaign_mark=$(/usr/bin/node "$POLICY_TOOL" campaign-mark "$transaction_id")
  /usr/bin/node --input-type=module - "$campaign_mark" "$STATE_TOOL" "$temporary" <<'NODE'
import fs from 'node:fs';
const [markText, tool, root] = process.argv.slice(2);
const records = [];
for (const source of 'nftables iptables ip6tables ipRules4 ipRules6 tc conntrack'.split(' ')) for (const line of fs.readFileSync(`${root}/${source}`, 'utf8').split('\n')) {
    if (!/(?:fw|ct|meta|packet[ -])?mark/i.test(line)) continue;
    let supported = false;
    for (const match of line.matchAll(/mark\s*&\s*0x([\da-f]{1,8})\s*==\s*0x([\da-f]{1,8})/gi)) { records.push({ source, mask: Number.parseInt(match[1], 16), value: Number.parseInt(match[2], 16) }); supported = true; }
    for (const match of line.matchAll(/(?:mark|fwmark)\D{0,12}(0x[\da-f]{1,8}|\d+)(?:\s*\/\s*(0x[\da-f]{1,8}|\d+))?/gi)) {
      const number = (value) => Number.parseInt(value, value.startsWith('0x') ? 16 : 10);
      records.push({ source, value: number(match[1]), mask: match[2] ? number(match[2]) : 0xffffffff }); supported = true;
    }
    if (!supported) records.push({ source, unsupported: true });
}
const { assertNoMarkCollision } = await import(tool);
assertNoMarkCollision(Number(markText), records);
NODE
  table=$(policy /networkAccounting/table)
  accounting=false
  /usr/sbin/nft list table inet "$table" >/dev/null 2>&1 && accounting=true
  [ "$accounting" = false ] || { printf '%s\n' 'measurement accounting table already exists' >&2; return 1; }
  /usr/bin/node "$NETWORK_CONTRACT" capture "$temporary" "$campaign_mark" "$external_name" "$external_ifindex" >"$temporary/network.json"
  baseline=$(/usr/bin/jq -er .baselineSha256 "$temporary/network.json")
}
audit_collisions() {
  socket=$(policy /dedicatedRuntime/dockerSocket); network=$(policy /dedicatedRuntime/networkName); bridge=$(policy /dedicatedRuntime/bridgeName)
  input_prefix=$(policy /dedicatedRuntime/ownedInputChainPrefix); forward_prefix=$(policy /dedicatedRuntime/ownedForwardChainPrefix); comment_prefix=$(policy /dedicatedRuntime/ruleCommentPrefix)
  /usr/bin/docker --host "unix://$socket" network inspect "$network" >/dev/null 2>&1 && fail 'collision audit: dedicated network exists'
  /usr/sbin/ip link show dev "$bridge" >/dev/null 2>&1 && fail 'collision audit: dedicated bridge exists'
  /usr/bin/grep -F -e "$comment_prefix" -e "$input_prefix" -e "$forward_prefix" "$temporary/iptables" && fail 'collision audit: owned firewall residue'
  /usr/sbin/iptables -S INPUT >"$temporary/input-anchor"; /usr/sbin/iptables -S DOCKER-USER >"$temporary/forward-anchor"
  /usr/bin/grep -F -e "$comment_prefix" -e "$input_prefix" -e "$forward_prefix" "$temporary/input-anchor" "$temporary/forward-anchor" && fail 'collision audit: anchor residue'
  /usr/bin/jq -r '.[]? | .IPAM.Config[]?.Subnet // empty' "$temporary/dockerNetworks" | /usr/bin/sort -u >"$temporary/production-cidrs"
}
revalidate_baseline() {
  snapshot_network; audit_collisions
  expected=$(/usr/bin/jq -er '.priorState.network.baselineSha256' "$STATE_ROOT/$transaction_id/capture.json")
  [ "$baseline" = "$expected" ] || fail 'network baseline drift after watchdog activation'
}
verify_production_unchanged() { snapshot_resources; capture="$STATE_ROOT/$transaction_id/capture.json"; for name in runners timers containers slices; do /usr/bin/jq -S . "$temporary/$name.json" >"$temporary/$name.actual"; /usr/bin/jq -S ".priorState.resources.$name" "$capture" >"$temporary/$name.expected"; /usr/bin/cmp -s "$temporary/$name.actual" "$temporary/$name.expected" || fail "production $name changed during prepare"; done; }
verify_watchdog_lease() {
  ready="$STATE_ROOT/$transaction_id/watchdog-ready.json"
  [ -f "$ready" ] && [ ! -L "$ready" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$ready")" = 0:600 ] || return 1
  canonical=$(/usr/bin/jq -cS . "$ready") && [ "$(/bin/cat "$ready")" = "$canonical" ] || return 1
  /usr/bin/jq -e --arg tx "$transaction_id" --arg mode "$mode" --arg sha "$capture_sha" '
    keys == ["captureSha256","leaseHolderPid","leaseHolderStartTime","leaseToken","lockDevice","lockHeld","lockInode","lockOwnerPid","mode","schemaVersion","transactionId","watchdogPid"] and
    .schemaVersion == 1 and .transactionId == $tx and .mode == $mode and .captureSha256 == $sha and
    (.watchdogPid,.leaseHolderPid,.leaseHolderStartTime|type == "number" and . > 1) and .lockOwnerPid == .leaseHolderPid and .lockHeld == true and
    (.leaseToken|test("^[a-f0-9]{64}$")) and (.lockDevice|type == "number") and (.lockInode|type == "number")' "$ready" >/dev/null || return 1
  watchdog_pid=$(/usr/bin/jq -er .watchdogPid "$ready"); [ -d "/proc/$watchdog_pid" ] || return 1
  holder=$STATE_ROOT/$transaction_id/lease-holder.json; [ -f "$holder" ] && [ ! -L "$holder" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$holder")" = 0:600 ] || return 1
  /usr/bin/jq -e --slurpfile ready "$ready" 'keys == ["captureSha256","holderPid","holderStartTime","lockDevice","lockHeld","lockInode","mode","schemaVersion","token","transactionId"] and .schemaVersion == 1 and .transactionId == $ready[0].transactionId and .captureSha256 == $ready[0].captureSha256 and .mode == $ready[0].mode and .holderPid == $ready[0].leaseHolderPid and .holderStartTime == $ready[0].leaseHolderStartTime and .token == $ready[0].leaseToken and .lockDevice == $ready[0].lockDevice and .lockInode == $ready[0].lockInode and .lockHeld == true' "$holder" >/dev/null || return 1
  holder_pid=$(/usr/bin/jq -er .leaseHolderPid "$ready"); holder_start=$(/usr/bin/jq -er .leaseHolderStartTime "$ready"); [ -d "/proc/$holder_pid" ] && [ "$(/usr/bin/awk '{sub(/^.*\) /, ""); print $20}' "/proc/$holder_pid/stat")" = "$holder_start" ] && [ "$(/usr/bin/jq -r '[.lockDevice,.lockInode]|join(":")' "$ready")" = "$lock_identity" ]
}
capture_host_state() {
  /usr/bin/jq -n --arg bootId "$(/bin/cat /proc/sys/kernel/random/boot_id)" --arg hostname "$(/bin/hostname --short)" '{bootId:$bootId,hostname:$hostname}' >"$temporary/host.json"
  /usr/bin/crontab -u bassey -l >"$temporary/crontab" 2>/dev/null || :; cron_sha=$(hash_file "$temporary/crontab"); [ "$cron_sha" = "$POST_CRON_SHA" ] || { printf '%s\n' 'post-retirement crontab drift' >&2; return 1; }; verify_cron_inventory
  cron_active=false; /bin/systemctl is-active --quiet cron.service && cron_active=true; cron_enabled=false; /bin/systemctl is-enabled --quiet cron.service && cron_enabled=true; snapshot_resources; snapshot_network; audit_collisions
  registration_authority=''
  if [ "$mode" = registration ]; then
    snapshot_registration_service_uids
    registration_authority="$temporary/registration-authority.json"
    /usr/bin/node "$CAPTURE_AUTHORITY" derive "$temporary/addresses" "$temporary/dockerNetworks" "$temporary/services.json" "$external_name" "$external_ifindex" >"$registration_authority"
  fi
  archive_path="$STATE_ROOT/$transaction_id/crontab.before"
  /usr/bin/jq -n --arg sha "$cron_sha" --arg archiveSha "$cron_sha" --arg archivePath "$archive_path" \
    --argjson cronActive "$cron_active" --argjson cronEnabled "$cron_enabled" \
    --slurpfile runners "$temporary/runners.json" --slurpfile timers "$temporary/timers.json" \
    --slurpfile containers "$temporary/containers.json" --slurpfile slices "$temporary/slices.json" \
    --slurpfile network "$temporary/network.json" \
    '{schemaVersion:1,cron:{sha256:$sha,archiveSha256:$archiveSha,archivePath:$archivePath,serviceActive:$cronActive,serviceEnabled:$cronEnabled},resources:{runners:$runners[0],timers:$timers[0],containers:$containers[0],slices:$slices[0]},network:$network[0]}' >"$temporary/prior.json"
}
capture_host_state
if [ -n "$registration_authority" ]; then
  capture_sha=$(/usr/bin/node "$STATE_TOOL" create-capture "$STATE_ROOT" "$transaction_id" "$mode" "$temporary/host.json" "$temporary/prior.json" "$registration_authority" "$temporary/addresses" "$temporary/dockerNetworks" "$temporary/services.json")
else
  capture_sha=$(/usr/bin/node "$STATE_TOOL" create-capture "$STATE_ROOT" "$transaction_id" "$mode" "$temporary/host.json" "$temporary/prior.json")
fi
assert_private_state_directory "$STATE_ROOT/$transaction_id"
restore_armed=1
/usr/bin/install -m 0600 "$temporary/crontab" "$STATE_ROOT/$transaction_id/crontab.before"
/usr/bin/sync -f "$STATE_ROOT/$transaction_id/crontab.before"
/usr/bin/node "$STATE_TOOL" phase "$STATE_ROOT" "$transaction_id" acquiring
watchdog_seconds=$(policy /repositoryAuthority/watchdogTimeoutSeconds)
creation_boot_id=$(/bin/cat /proc/sys/kernel/random/boot_id)
monotonic_now=$(/usr/bin/cut -d' ' -f1 /proc/uptime | /usr/bin/cut -d. -f1)
source_digest=$(/usr/bin/node "$SOURCE_CLOSURE" digest "$SCRIPT_DIR")
environment_file="$STATE_ROOT/$transaction_id/watchdog.env"
{ printf 'TRANSACTION_ID=%s\nMODE=%s\nCAPTURE_SHA=%s\nSOURCE_DIGEST=%s\n' "$transaction_id" "$mode" "$capture_sha" "$source_digest"; printf 'CREATION_BOOT_ID=%s\nUTC_DEADLINE=%s\nMONOTONIC_DEADLINE=%s\n' "$creation_boot_id" "$(/bin/date -u -d "@$(( $(/bin/date +%s) + watchdog_seconds ))" +%Y-%m-%dT%H:%M:%SZ)" "$((monotonic_now + watchdog_seconds))"; } >"$environment_file"
/bin/chmod 0600 "$environment_file"; /usr/bin/sync -f "$environment_file"; /usr/bin/sync -f "$STATE_ROOT/$transaction_id"
watchdog="baci-cwv-campaign-watchdog@${transaction_id}.service"
lease_token=$(/usr/bin/od -An -N32 -tx1 /dev/urandom | /usr/bin/tr -d ' \n')
"$LEASE_HOLDER" "$transaction_id" "$capture_sha" "$mode" "$lease_token" & lease_holder_pid=$!
attempt=0; until [ -f "$STATE_ROOT/$transaction_id/lease-holder.json" ] && /usr/bin/jq -e --argjson pid "$lease_holder_pid" --arg token "$lease_token" '.holderPid == $pid and .token == $token and .lockHeld == true' "$STATE_ROOT/$transaction_id/lease-holder.json" >/dev/null; do attempt=$((attempt + 1)); [ "$attempt" -lt 100 ] || fail 'lease holder did not prove inherited campaign lock'; /bin/sleep 0.1; done
/bin/systemctl enable --now "$watchdog"; /bin/systemctl is-active --quiet "$watchdog"
journal start-watchdog "$watchdog"
# Keep the acquired descriptor open until this transaction exits. The inherited
# descriptor is held by the lease holder until terminal restoration releases it.
attempt=0; until verify_watchdog_lease; do attempt=$((attempt + 1)); [ "$attempt" -lt 100 ] || fail 'watchdog did not prove exclusive campaign lease'; /bin/sleep 0.1; done
/usr/bin/flock -n "$LOCK" /bin/true && fail 'watchdog lease is not continuously exclusive'
revalidate_baseline
if [ "$mode" = prepare ]; then verify_production_unchanged; fi
case "$mode" in campaign|rehearsal)
  /usr/bin/jq -e '.activeCronProcessTrees | type == "array" and length == 0' "$INVENTORY" >/dev/null || fail 'reviewed cron descendants require manual recovery'
  capture_cron_trees; verify_cron_trees
  freeze_cron_tree; /usr/bin/jq -e 'length == 0' "$temporary/cron-tree-final.json" >/dev/null || fail 'new cron descendant appeared during freeze'; /bin/systemctl stop cron.service; journal stop-unit cron.service
  for unit in $(/usr/bin/jq -r '.priorState.resources.runners[] | .id' "$STATE_ROOT/$transaction_id/capture.json"); do /bin/systemctl stop "$unit"; journal stop-unit "$unit"; done
  for unit in $(/usr/bin/jq -r '.priorState.resources.timers[] | select(.active) | .id' "$STATE_ROOT/$transaction_id/capture.json"); do [ "$unit" = baci-cwv-host-sampler.timer ] || { /bin/systemctl stop "$unit"; journal stop-timer "$unit"; }; done
  /bin/sleep 1; /usr/bin/atq >"$temporary/atq"; ! /bin/systemctl is-active --quiet cron.service && ! /usr/bin/pgrep -f 'Runner\.Listener|Runner\.Worker' >/dev/null && [ ! -s "$temporary/atq" ] || fail 'cron, at, or captured runner work remains'
  /bin/systemctl set-property --runtime cwv-measurement.slice "AllowedCPUs=$measurement_cpu_set"; journal set-cpuset "cwv-measurement.slice:$measurement_cpu_set"
  for slice in system.slice user.slice machine.slice; do /bin/systemctl set-property --runtime "$slice" "AllowedCPUs=$other_cpu_set"; journal set-cpuset "$slice:$other_cpu_set"; done
  for container in $(/usr/bin/jq -r '.priorState.resources.containers[] | select(.running and .role == "autoheal") | .id' "$STATE_ROOT/$transaction_id/capture.json"); do /usr/bin/docker stop "$container" >/dev/null; journal stop-container "$container"; done
  for container in $(/usr/bin/jq -r '.priorState.resources.containers[] | select(.running and .role == "application") | .id' "$STATE_ROOT/$transaction_id/capture.json"); do /usr/bin/docker update --cpuset-cpus "$other_cpu_set" "$container" >/dev/null; journal docker-cpuset "$container:$other_cpu_set"; done
;; esac
if [ "$mode" = campaign ]; then
  /bin/systemctl start baci-cwv-containerd.service; journal start-dedicated-unit baci-cwv-containerd.service; /bin/systemctl is-active --quiet baci-cwv-containerd.service
  /bin/systemctl start baci-cwv-docker.service; journal start-dedicated-unit baci-cwv-docker.service; /bin/systemctl is-active --quiet baci-cwv-docker.service
  socket=$(policy /dedicatedRuntime/dockerSocket)
  network=$(policy /dedicatedRuntime/networkName)
  gateway=$(policy /dedicatedRuntime/gateway)
  subnet=$(policy /dedicatedRuntime/subnet)
  bridge=$(policy /dedicatedRuntime/bridgeName)
  /usr/bin/jq -cS -n --arg name "$network" --arg bridge "$bridge" --arg gateway "$gateway" --arg subnet "$subnet" --arg transaction "$transaction_id" --arg capture "$capture_sha" --arg baseline "$baseline" --slurpfile prior "$temporary/network.json" '{schemaVersion:1,name:$name,bridge:$bridge,gateway:$gateway,subnet:$subnet,labels:{"baci.cwv.capture":$capture,"baci.cwv.transaction":$transaction},baselineSha256:$baseline,externalInterface:$prior[0].externalInterface,inventories:$prior[0].inventories}' >"$temporary/network-plan.json"
  ownership network-intent "$transaction_id" "$capture_sha" "$temporary/network-plan.json"
  /usr/bin/docker --host "unix://$socket" network create --driver bridge --subnet "$subnet" --gateway "$gateway" --opt "com.docker.network.bridge.name=$bridge" --label "baci.cwv.transaction=$transaction_id" --label "baci.cwv.capture=$capture_sha" --ipv6=false "$network" >/dev/null
  /usr/bin/docker --host "unix://$socket" network inspect "$network" >"$temporary/dedicated-network.inspect"
  ownership network-applied "$temporary/dedicated-network.inspect"; network_identity=$(/usr/bin/jq -ce .network.identity "$STATE_ROOT/$transaction_id/ownership.json"); journal create-network "$network_identity"
  suffix=$(printf '%s' "$transaction_id" | /usr/bin/sha256sum | /usr/bin/cut -c1-8); input_chain="$(policy /dedicatedRuntime/ownedInputChainPrefix)$suffix"; forward_chain="$(policy /dedicatedRuntime/ownedForwardChainPrefix)$suffix"
  comment="$(policy /dedicatedRuntime/ruleCommentPrefix)$transaction_id"; external=$(/usr/bin/jq -r '.priorState.network.externalInterface.name' "$STATE_ROOT/$transaction_id/capture.json")
  policy /dedicatedRuntime/deniedDestinationCidrs | /usr/bin/jq -er '.[]' >"$temporary/denied-cidrs"
  owned_iptables_mutation input-chain -N "$input_chain"; owned_iptables_mutation forward-chain -N "$forward_chain"
  owned_iptables_mutation input-source -A "$input_chain" -i "$bridge" ! -s "$subnet" -j REJECT
  /usr/bin/cat "$temporary/denied-cidrs" "$temporary/production-cidrs" | /usr/bin/sort -u | while IFS= read -r cidr; do owned_iptables_mutation "deny-input:$cidr" -A "$input_chain" -i "$bridge" -s "$subnet" -d "$cidr" -j REJECT; owned_iptables_mutation "deny-forward:$cidr" -A "$forward_chain" -i "$bridge" -s "$subnet" -d "$cidr" -j REJECT; done
  owned_iptables_mutation input-default -A "$input_chain" -i "$bridge" -s "$subnet" -j REJECT
  owned_iptables_mutation forward-source -A "$forward_chain" -i "$bridge" ! -s "$subnet" -j REJECT
  owned_iptables_mutation forward-reply -A "$forward_chain" -i "$external" -o "$bridge" -d "$subnet" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
  owned_iptables_mutation forward-egress -A "$forward_chain" -i "$bridge" -s "$subnet" -o "$external" -j ACCEPT
  owned_iptables_mutation forward-default -A "$forward_chain" -i "$bridge" -j REJECT
  owned_iptables_mutation input-anchor -I INPUT 1 -m comment --comment "$comment" -j "$input_chain"
  owned_iptables_mutation forward-anchor -I DOCKER-USER 1 -m comment --comment "$comment" -j "$forward_chain"
  owned_iptables_mutation nat-anchor -t nat -I POSTROUTING 1 -s "$subnet" -o "$external" -m comment --comment "$comment" -j MASQUERADE
  /usr/sbin/iptables -C INPUT -m comment --comment "$comment" -j "$input_chain"
  /usr/sbin/iptables -C DOCKER-USER -m comment --comment "$comment" -j "$forward_chain"
  /usr/sbin/iptables -t nat -C POSTROUTING -s "$subnet" -o "$external" -m comment --comment "$comment" -j MASQUERADE
  /usr/bin/cat "$temporary/denied-cidrs" "$temporary/production-cidrs" | /usr/bin/sort -u | while IFS= read -r cidr; do /usr/sbin/iptables -C "$input_chain" -i "$bridge" -s "$subnet" -d "$cidr" -j REJECT; /usr/sbin/iptables -C "$forward_chain" -i "$bridge" -s "$subnet" -d "$cidr" -j REJECT; done
  /usr/sbin/iptables -C "$input_chain" -i "$bridge" ! -s "$subnet" -j REJECT; /usr/sbin/iptables -C "$input_chain" -i "$bridge" -s "$subnet" -j REJECT; /usr/sbin/iptables -C "$forward_chain" -i "$bridge" ! -s "$subnet" -j REJECT; /usr/sbin/iptables -C "$forward_chain" -i "$external" -o "$bridge" -d "$subnet" -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT; /usr/sbin/iptables -C "$forward_chain" -i "$bridge" -s "$subnet" -o "$external" -j ACCEPT; /usr/sbin/iptables -C "$forward_chain" -i "$bridge" -j REJECT
  /usr/sbin/iptables -S "$input_chain" >"$temporary/isolation-input.readback"; /usr/sbin/iptables -S "$forward_chain" >"$temporary/isolation-forward.readback"
  journal install-isolation "$input_chain:$forward_chain:$comment"
fi
if [ "$mode" = campaign ]; then
  printf '%s\n' "$external" | /usr/bin/grep -Eq '^[A-Za-z0-9_.-]{1,15}$' || { printf '%s\n' 'invalid accounting interface' >&2; exit 65; }
  external_ifindex=$(/usr/bin/jq -er '.priorState.network.externalInterface.ifindex' "$STATE_ROOT/$transaction_id/capture.json")
  [ "$(/usr/sbin/ip -json link show dev "$external" | /usr/bin/jq -er '.[0].ifindex')" = "$external_ifindex" ] && [ "$(/usr/bin/jq -er '.priorState.network.campaignMark' "$STATE_ROOT/$transaction_id/capture.json")" = "$campaign_mark" ] || { printf '%s\n' 'external interface or mark drift' >&2; exit 65; }
  family=$(policy /networkAccounting/family); table=$(policy /networkAccounting/table)
  classify_chain=$(policy /networkAccounting/classifyChain); classify_hook=$(policy /networkAccounting/classifyHook); classify_priority=$(policy /networkAccounting/classifyPriority)
  ingress_chain=$(policy /networkAccounting/ingressChain); host_ingress_chain=$(policy /networkAccounting/hostIngressChain); ingress_hook=$(policy /networkAccounting/ingressHook); host_ingress_hook=$(policy /networkAccounting/hostIngressHook)
  egress_chain=$(policy /networkAccounting/egressChain); host_egress_chain=$(policy /networkAccounting/hostEgressChain); egress_hook=$(policy /networkAccounting/egressHook); counter_priority=$(policy /networkAccounting/counterPriority)
  comment_prefix=$(policy /dedicatedRuntime/ruleCommentPrefix); campaign_mark_hex=$(/usr/bin/printf '0x%08x' "$campaign_mark")
  [ "$classify_priority" -lt "$counter_priority" ] || { printf '%s\n' 'classifier must precede accounting counters' >&2; exit 65; }
  [ "$classify_hook:$ingress_hook:$host_ingress_hook:$egress_hook" = forward:forward:input:postrouting ] || { printf '%s\n' 'accounting hook drift' >&2; exit 65; }
  /bin/cat >"$temporary/accounting.nft" <<ACCOUNTING_BASE_NFT
add table $family $table
add chain $family $table $classify_chain { type filter hook $classify_hook priority $classify_priority; policy accept; }
add chain $family $table $ingress_chain { type filter hook $ingress_hook priority $counter_priority; policy accept; }
add chain $family $table $host_ingress_chain { type filter hook $host_ingress_hook priority $counter_priority; policy accept; }
add chain $family $table $egress_chain { type filter hook $egress_hook priority $counter_priority; policy accept; }
add chain $family $table $host_egress_chain { type filter hook $egress_hook priority $counter_priority; policy accept; }
add rule $family $table $ingress_chain iifname "$external" fib daddr type != local counter comment "$comment_prefix$transaction_id:forwarded-ingress"
add rule $family $table $host_ingress_chain iifname "$external" counter comment "$comment_prefix$transaction_id:host-local-ingress"
add rule $family $table $egress_chain oifname "$external" meta iif != 0 counter comment "$comment_prefix$transaction_id:forwarded-egress"
add rule $family $table $egress_chain oifname "$external" meta iif != 0 ct mark $campaign_mark_hex counter comment "$comment_prefix$transaction_id:measurement-egress"
add rule $family $table $host_egress_chain oifname "$external" meta iif 0 counter comment "$comment_prefix$transaction_id:host-originated-egress"
ACCOUNTING_BASE_NFT
  /usr/bin/jq -cS -n --arg family "$family" --arg table "$table" --arg classifyChain "$classify_chain" --arg classifyHook "$classify_hook" --argjson classifyPriority "$classify_priority" --arg ingressChain "$ingress_chain" --arg hostIngressChain "$host_ingress_chain" --arg ingressHook "$ingress_hook" --arg hostIngressHook "$host_ingress_hook" --arg egressChain "$egress_chain" --arg hostEgressChain "$host_egress_chain" --arg egressHook "$egress_hook" --argjson counterPriority "$counter_priority" --argjson campaignMark "$campaign_mark" --arg externalInterface "$external" --arg transactionId "$transaction_id" --arg commentPrefix "$comment_prefix" '{family:$family,table:$table,classifyChain:$classifyChain,classifyHook:$classifyHook,classifyPriority:$classifyPriority,ingressChain:$ingressChain,hostIngressChain:$hostIngressChain,ingressHook:$ingressHook,hostIngressHook:$hostIngressHook,egressChain:$egressChain,hostEgressChain:$hostEgressChain,egressHook:$egressHook,counterPriority:$counterPriority,campaignMark:$campaignMark,externalInterface:$externalInterface,transactionId:$transactionId,commentPrefix:$commentPrefix}' >"$temporary/accounting-config.json"
  /usr/bin/node "$ACCOUNTING_CONTRACT" plan "$temporary/accounting-config.json" >"$temporary/accounting-plan.json"; ownership accounting-intent "$temporary/accounting-plan.json"
  /usr/sbin/nft -f "$temporary/accounting.nft"; /usr/sbin/nft -j -a list table "$family" "$table" >"$temporary/accounting-readback.json"
  /usr/bin/node "$ACCOUNTING_CONTRACT" identity "$temporary/accounting-plan.json" "$temporary/accounting-readback.json" >"$temporary/accounting-base-identity.json"; ownership accounting-applied "$temporary/accounting-base-identity.json"
  /usr/bin/install -m 0600 "$temporary/accounting-base-identity.json" "$STATE_ROOT/$transaction_id/accounting-base-identity.json"; /usr/bin/sync -f "$STATE_ROOT/$transaction_id/accounting-base-identity.json"; journal install-accounting-base "$(hash_file "$STATE_ROOT/$transaction_id/accounting-base-identity.json")"
fi
/usr/bin/node "$STATE_TOOL" phase "$STATE_ROOT" "$transaction_id" active
restore_armed=0
trap - EXIT HUP INT TERM
/bin/rm -rf -- "$temporary"
printf '%s\n' "$capture_sha"
