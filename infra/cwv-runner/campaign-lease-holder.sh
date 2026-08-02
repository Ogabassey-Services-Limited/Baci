#!/bin/sh
set -eu
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8 TZ=Etc/UTC
umask 077
STATE_ROOT=/srv/baci-cwv/campaigns; LOCK=/run/lock/baci-cwv-campaign.lock
[ "$#" -eq 4 ] || exit 64
transaction_id=$1 capture_sha=$2 mode=$3 token=$4
printf '%s' "$transaction_id" | /usr/bin/grep -Eq '^[a-z0-9][a-z0-9-]{0,62}$' || exit 64
printf '%s' "$capture_sha" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || exit 64
case "$mode" in prepare|registration|campaign|rehearsal) ;; *) exit 64;; esac
printf '%s' "$token" | /usr/bin/grep -Eq '^[a-f0-9]{64}$' || exit 64
directory="$STATE_ROOT/$transaction_id"; record="$directory/lease-holder.json"; release="$directory/lease-release.json"
[ -d "$directory" ] && [ ! -L "$directory" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$directory")" = 0:700 ] || exit 65
[ -e "/proc/$$/fd/9" ] && [ "$(/usr/bin/readlink -f -- "/proc/$$/fd/9")" = "$LOCK" ] || exit 65
/usr/bin/flock -n 9 || exit 75
start_time=$(/usr/bin/awk '{sub(/^.*\) /, ""); print $20}' "/proc/$$/stat")
lock_device=$(/usr/bin/stat -c '%d' -- "$LOCK"); lock_inode=$(/usr/bin/stat -c '%i' -- "$LOCK")
temporary="$record.tmp-$$"
/usr/bin/jq -S -cn --arg transactionId "$transaction_id" --arg captureSha256 "$capture_sha" --arg mode "$mode" --arg token "$token" --argjson holderPid "$$" --argjson holderStartTime "$start_time" --argjson lockDevice "$lock_device" --argjson lockInode "$lock_inode" '{schemaVersion:1,transactionId:$transactionId,captureSha256:$captureSha256,mode:$mode,token:$token,holderPid:$holderPid,holderStartTime:$holderStartTime,lockDevice:$lockDevice,lockInode:$lockInode,lockHeld:true}' >"$temporary"
/bin/chmod 0600 "$temporary"; /usr/bin/sync -f "$temporary"; /bin/mv -T "$temporary" "$record"; /usr/bin/sync -f "$directory"
while [ ! -e "$release" ]; do /bin/sleep 1; done
[ -f "$release" ] && [ ! -L "$release" ] && [ "$(/usr/bin/stat -c '%u:%a' -- "$release")" = 0:600 ] || exit 65
/usr/bin/jq -e --arg tx "$transaction_id" --arg token "$token" 'keys == ["schemaVersion","token","transactionId"] and .schemaVersion == 1 and .transactionId == $tx and .token == $token' "$release" >/dev/null
/bin/rm -f -- "$record"; /usr/bin/sync -f "$directory"
