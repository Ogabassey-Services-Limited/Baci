#!/bin/sh
set -eu

PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077

SCRIPT_DIR=$(CDPATH='' cd -- "$(/usr/bin/dirname -- "$0")" && /bin/pwd -P)
readonly SCRIPT_DIR
readonly STATE_ROOT=/srv/baci-cwv/campaigns
readonly STATE_TOOL="$SCRIPT_DIR/campaign-state.mjs"
readonly RESTORE="$SCRIPT_DIR/campaign-restore.sh"
readonly SOURCE_CLOSURE="$SCRIPT_DIR/campaign-source-closure.mjs"
readonly POLICY_FILE="$SCRIPT_DIR/policy.json"

[ "$#" -eq 1 ] || { printf '%s\n' 'usage: campaign-watchdog.sh <transaction-id>' >&2; exit 64; }
transaction_id=$1
printf '%s' "$transaction_id" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$' || exit 64
restore_armed=0
ready_file=

assert_private_state_directory() {
  state_dir=$1
  [ -d "$state_dir" ] && [ ! -L "$state_dir" ] || { printf '%s\n' 'secure campaign state directory required' >&2; exit 65; }
  [ "$(/usr/bin/stat -c '%u:%a' -- "$state_dir")" = 0:700 ] || { printf '%s\n' 'secure campaign state directory required' >&2; exit 65; }
}
assert_root_regular_file() {
  [ -f "$1" ] && [ ! -L "$1" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$1")" = 0:600 ]
}
hash_file() { /usr/bin/sha256sum "$1" | /usr/bin/cut -d' ' -f1; }

remove_readiness() {
  [ -n "$ready_file" ] && [ -e "$ready_file" ] || return 0
  assert_root_regular_file "$ready_file" || return 1
  /bin/rm -f -- "$ready_file"
  /usr/bin/sync -f "$directory"
}
verify_receipt() {
  receipt="$directory/restored.json"
  assert_root_regular_file "$receipt" || return 1
  cron_sha=$(/usr/bin/jq -er '.priorState.cron.sha256' "$directory/capture.json")
  /usr/bin/jq -e --arg mode "$mode" --arg capture "$capture_sha" \
    --arg policy "$policy_file_sha" --arg source "$source_digest" --arg cron "$cron_sha" '
      .schemaVersion == 1 and .mode == $mode and .captureSha256 == $capture and
      .policyFileSha256 == $policy and .sourceDigest == $source and .reconciled == true and
      .residualState == {accountingTablePresent:false,cronSha256:$cron,dedicatedNetworkPresent:false,
        dedicatedServicesActive:false,ownedFirewallPresent:false,samplerActive:false,transactionContainerCount:0} and
      (.progress | type == "object") and
      (if $mode == "campaign" then
        keys == ["accountingFinalSha256","captureSha256","mode","policyFileSha256","progress","reconciled","residualState","schemaVersion","sourceDigest"] and
        (.accountingFinalSha256 == null or (.accountingFinalSha256 | type == "string" and test("^[a-f0-9]{64}$")))
      else keys == ["captureSha256","mode","policyFileSha256","progress","reconciled","residualState","schemaVersion","sourceDigest"] end)
    ' "$receipt" >/dev/null || return 1
  [ "$(/bin/cat "$directory/phase.json")" = '{"phase":"restored"}' ]
}
restore_and_verify() {
  if verify_receipt && [ ! -e "$directory/restore-post-commit-failed.json" ]; then return 0; fi
  "$RESTORE" "$transaction_id" "$capture_sha" || return 1
  verify_receipt && [ ! -e "$directory/restore-post-commit-failed.json" ]
}
restore_until_reconciled() { while ! restore_and_verify; do /bin/sleep 2; done; }
restore_now() {
  status_code=$?
  trap - EXIT HUP INT TERM
  if [ "$restore_armed" -eq 1 ] && restore_until_reconciled; then
    remove_readiness || exit 1
    exit 0
  fi
  exit "$status_code"
}
# Install cleanup before any capture, source, or environment validation.
trap restore_now EXIT HUP INT TERM

assert_private_state_directory "$STATE_ROOT"
directory="$STATE_ROOT/$transaction_id"
assert_private_state_directory "$directory"
ready_file="$directory/watchdog-ready.json"
capture_sha=$(/bin/cat "$directory/capture.sha256")
mode=$(/usr/bin/node "$STATE_TOOL" verify-capture "$STATE_ROOT" "$transaction_id" "$capture_sha")
case "$mode" in prepare|registration|campaign|rehearsal) ;; *) exit 65 ;; esac
[ -f "$POLICY_FILE" ] && [ ! -L "$POLICY_FILE" ] || exit 66
policy_file_sha=$(hash_file "$POLICY_FILE")
source_digest=$(/usr/bin/node "$SOURCE_CLOSURE" digest "$SCRIPT_DIR")

# A reconciled transaction needs no lease or readiness proof.
if [ -e "$directory/restored.json" ]; then
  restore_armed=1
  restore_and_verify
  remove_readiness
  trap - EXIT HUP INT TERM
  exit 0
fi
environment_file="$directory/watchdog.env"
[ -f "$environment_file" ] && [ ! -L "$environment_file" ] || { printf '%s\n' 'watchdog environment missing' >&2; exit 66; }
[ "$(/usr/bin/wc -l <"$environment_file" | /usr/bin/tr -d ' ')" -eq 7 ] || exit 66
read_field() { /usr/bin/sed -n "s/^$1=//p" "$environment_file"; }
[ "$(read_field TRANSACTION_ID)" = "$transaction_id" ] || exit 66
[ "$(read_field MODE)" = "$mode" ] || exit 66
[ "$(read_field CAPTURE_SHA)" = "$capture_sha" ] || exit 66
[ "$(read_field SOURCE_DIGEST)" = "$source_digest" ] || exit 66
boot_id=$(/bin/cat /proc/sys/kernel/random/boot_id)
captured_boot_id=$(/usr/bin/jq -er '.host.bootId' "$directory/capture.json")
[ "$(read_field CREATION_BOOT_ID)" = "$captured_boot_id" ] || exit 66
utc_deadline=$(read_field UTC_DEADLINE)
printf '%s' "$utc_deadline" | /usr/bin/grep -Eq '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$' || exit 66
utc_deadline_epoch=$(/bin/date -u -d "$utc_deadline" +%s)
deadline=$(read_field MONOTONIC_DEADLINE)
printf '%s' "$deadline" | /usr/bin/grep -Eq '^[0-9]+$' || exit 66
restore_armed=1

lease="$directory/lease-holder.json"
[ -f "$lease" ] && [ ! -L "$lease" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$lease")" = 0:600 ] || exit 66
canonical=$(/usr/bin/jq -cS . "$lease") && [ "$(/bin/cat "$lease")" = "$canonical" ] || exit 66
/usr/bin/jq -e --arg tx "$transaction_id" --arg mode "$mode" --arg sha "$capture_sha" 'keys == ["captureSha256","holderPid","holderStartTime","lockDevice","lockHeld","lockInode","mode","schemaVersion","token","transactionId"] and .schemaVersion == 1 and .transactionId == $tx and .mode == $mode and .captureSha256 == $sha and (.holderPid,.holderStartTime|type == "number" and . > 1) and (.token|test("^[a-f0-9]{64}$")) and (.lockDevice,.lockInode|type == "number") and .lockHeld == true' "$lease" >/dev/null || exit 66
lease_holder_pid=$(/usr/bin/jq -er .holderPid "$lease"); lease_holder_start=$(/usr/bin/jq -er .holderStartTime "$lease")
[ -d "/proc/$lease_holder_pid" ] && [ "$(/usr/bin/awk '{sub(/^.*\) /, ""); print $20}' "/proc/$lease_holder_pid/stat")" = "$lease_holder_start" ] || exit 66
remove_readiness
if verify_receipt; then
  trap - EXIT HUP INT TERM
  exit 0
fi
lock_device=$(/usr/bin/jq -er .lockDevice "$lease"); lock_inode=$(/usr/bin/jq -er .lockInode "$lease"); lease_token=$(/usr/bin/jq -er .token "$lease")
temporary="$ready_file.tmp-$$"
/usr/bin/jq -S -cn --arg transactionId "$transaction_id" --arg mode "$mode" \
  --arg captureSha256 "$capture_sha" --arg leaseToken "$lease_token" --argjson watchdogPid "$$" --argjson leaseHolderPid "$lease_holder_pid" --argjson leaseHolderStartTime "$lease_holder_start" \
  --argjson lockDevice "$lock_device" --argjson lockInode "$lock_inode" \
  '{schemaVersion:1,transactionId:$transactionId,mode:$mode,captureSha256:$captureSha256,watchdogPid:$watchdogPid,leaseHolderPid:$leaseHolderPid,leaseHolderStartTime:$leaseHolderStartTime,leaseToken:$leaseToken,lockDevice:$lockDevice,lockInode:$lockInode,lockOwnerPid:$leaseHolderPid,lockHeld:true}' >"$temporary"
/bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"
/bin/mv -T "$temporary" "$ready_file"; /usr/bin/sync -f "$directory"

monotonic=$(/usr/bin/cut -d' ' -f1 /proc/uptime | /usr/bin/cut -d. -f1)
current_utc=$(/bin/date -u +%s)
if [ "$boot_id" != "$captured_boot_id" ] || [ "$monotonic" -ge "$deadline" ] || [ "$current_utc" -ge "$utc_deadline_epoch" ]; then
  restore_and_verify
  remove_readiness
  trap - EXIT HUP INT TERM
  exit 0
fi
while [ "$monotonic" -lt "$deadline" ] && [ "$current_utc" -lt "$utc_deadline_epoch" ]; do
  /bin/sleep 5
  if verify_receipt && [ ! -e "$directory/restore-post-commit-failed.json" ]; then remove_readiness; trap - EXIT HUP INT TERM; exit 0; fi
  monotonic=$(/usr/bin/cut -d' ' -f1 /proc/uptime | /usr/bin/cut -d. -f1)
  current_utc=$(/bin/date -u +%s)
done
restore_and_verify
remove_readiness
trap - EXIT HUP INT TERM
