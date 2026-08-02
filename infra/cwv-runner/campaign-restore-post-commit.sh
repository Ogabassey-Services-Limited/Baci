#!/bin/sh
# shellcheck disable=SC2154
release_lease_holder() {
  lease="$directory/lease-holder.json"
  if [ ! -e "$lease" ]; then
    stale_release="$directory/lease-release.json"
    [ ! -e "$stale_release" ] && return 0
    [ -f "$stale_release" ] && [ ! -L "$stale_release" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$stale_release")" = 0:600 ] || return 1
    canonical=$(/usr/bin/jq -cS . "$stale_release") && [ "$(/bin/cat "$stale_release")" = "$canonical" ] || return 1
    /usr/bin/jq -e --arg tx "$transaction_id" 'keys == ["schemaVersion","token","transactionId"] and .schemaVersion == 1 and .transactionId == $tx and (.token | test("^[a-f0-9]{64}$"))' "$stale_release" >/dev/null || return 1
    /bin/rm -f -- "$stale_release" && /usr/bin/sync -f "$directory" || return 1
    return 0
  fi
  [ -f "$lease" ] && [ ! -L "$lease" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$lease")" = 0:600 ] || return 1
  canonical=$(/usr/bin/jq -cS . "$lease") && [ "$(/bin/cat "$lease")" = "$canonical" ] || return 1
  token=$(/usr/bin/jq -er --arg tx "$transaction_id" --arg mode "$mode" --arg sha "$capture_sha" 'if keys == ["captureSha256","holderPid","holderStartTime","lockDevice","lockHeld","lockInode","mode","schemaVersion","token","transactionId"] and .schemaVersion == 1 and .transactionId == $tx and .mode == $mode and .captureSha256 == $sha and all([.holderPid,.holderStartTime][]; type == "number" and . > 1) and (.token|test("^[a-f0-9]{64}$")) and all([.lockDevice,.lockInode][]; type == "number") and .lockHeld == true then .token else error("invalid") end' "$lease") || return 1
  temporary="$directory/lease-release.json.tmp"
  /usr/bin/jq -S -cn --arg token "$token" --arg transactionId "$transaction_id" '{schemaVersion:1,transactionId:$transactionId,token:$token}' >"$temporary" && /bin/chmod 0600 "$temporary" && /usr/bin/sync -f "$temporary" && /bin/mv -T "$temporary" "$directory/lease-release.json" && /usr/bin/sync -f "$directory" || return 1
  for _ in 1 2 3 4 5; do [ ! -e "$lease" ] && [ ! -L "$lease" ] && { /bin/rm -f -- "$directory/lease-release.json"; return 0; }; /bin/sleep 1; done
  return 1
}

post_commit_cleanup() {
  watchdog_action=${1:-}; case "$watchdog_action" in ''|--stop-watchdog) ;; *) return 1;; esac
  lease_holder_released=true; release_lease_holder || lease_holder_released=false
  watchdog_disabled=true; if [ "$watchdog_action" = --stop-watchdog ]; then /bin/systemctl disable --now "baci-cwv-campaign-watchdog@${transaction_id}.service" >/dev/null 2>&1 || watchdog_disabled=false; else /bin/systemctl disable "baci-cwv-campaign-watchdog@${transaction_id}.service" >/dev/null 2>&1 || watchdog_disabled=false; fi
  environment_removed=true; /bin/rm -f -- "$environment_file" || environment_removed=false
  receipt_cleared=true; /bin/rm -f -- "$directory/restore-post-commit-failed.json" || receipt_cleared=false; /usr/bin/sync -f "$directory" || receipt_cleared=false
  [ "$lease_holder_released" = true ] && [ "$watchdog_disabled" = true ] && [ "$environment_removed" = true ] && [ "$receipt_cleared" = true ] && return 0
  temporary="$directory/restore-post-commit-failed.json.tmp"
  /usr/bin/jq -S -cn --arg mode "$mode" --arg captureSha256 "$capture_sha" --arg policyFileSha256 "$policy_file_sha" --arg sourceDigest "$source_digest" --argjson leaseHolderReleased "$lease_holder_released" --argjson watchdogDisabled "$watchdog_disabled" --argjson environmentRemoved "$environment_removed" --argjson receiptCleared "$receipt_cleared" '{captureSha256:$captureSha256,cleanup:{environmentRemoved:$environmentRemoved,leaseHolderReleased:$leaseHolderReleased,receiptCleared:$receiptCleared,watchdogDisabled:$watchdogDisabled},mode:$mode,policyFileSha256:$policyFileSha256,reconciled:true,schemaVersion:1,sourceDigest:$sourceDigest}' >"$temporary" || return 1
  /bin/chmod 0600 "$temporary" && /usr/bin/sync -f "$temporary" && /bin/mv -T "$temporary" "$directory/restore-post-commit-failed.json" && /usr/bin/sync -f "$directory" || return 1
  return 1
}

retry_reconciled_cleanup() {
  watchdog_action=${1:-}
  [ "$reconciled_retry" = true ] || return 0; marker="$directory/restore-post-commit-failed.json"
  [ -f "$marker" ] && [ ! -L "$marker" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$marker")" = 0:600 ] || return 1
  /usr/bin/jq -e --arg mode "$mode" --arg capture "$capture_sha" --arg policy "$policy_file_sha" --arg source "$source_digest" '.schemaVersion == 1 and .reconciled == true and .mode == $mode and .captureSha256 == $capture and .policyFileSha256 == $policy and .sourceDigest == $source and (.cleanup | keys == ["environmentRemoved","leaseHolderReleased","receiptCleared","watchdogDisabled"] and all(.[]; type == "boolean"))' "$marker" >/dev/null || return 1
  post_commit_cleanup "$watchdog_action"
}
