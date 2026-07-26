#!/bin/sh
# Validates the sole fixed runner account before any group-readable path exists.
set -eu
PATH=/usr/sbin:/usr/bin:/sbin:/bin
export PATH LC_ALL=C.UTF-8

die() { /usr/bin/printf '%s\n' "$1" >&2; exit 65; }

main() {
  [ "$#" -eq 3 ] || die 'runner identity arguments required'
  user=$1 uid=$2 gid=$3
  [ "$user" = baci-cwv ] && [ "$uid" = 10001 ] && [ "$gid" = 10001 ] || die 'unexpected runner identity'
  if ! /usr/bin/getent group "$user" >/dev/null; then /usr/sbin/groupadd --gid "$gid" -- "$user"; fi
  if ! /usr/bin/getent passwd "$user" >/dev/null; then
    /usr/sbin/useradd --uid "$uid" --gid "$gid" --home-dir /nonexistent --shell /usr/sbin/nologin --no-create-home -- "$user"
  fi
  group_rows=$(/usr/bin/getent group | /usr/bin/awk -F: -v name="$user" -v gid="$gid" '$1 == name || $3 == gid { print }')
  [ "$(printf '%s\n' "$group_rows" | /usr/bin/wc -l | /usr/bin/tr -d ' ')" = 1 ] || die 'runner group collision'
  [ "$group_rows" = "$user:x:$gid:" ] || die 'runner group identity drift'
  passwd_rows=$(/usr/bin/getent passwd | /usr/bin/awk -F: -v name="$user" -v uid="$uid" -v gid="$gid" '$1 == name || $3 == uid || $4 == gid { print }')
  [ "$(printf '%s\n' "$passwd_rows" | /usr/bin/wc -l | /usr/bin/tr -d ' ')" = 1 ] || die 'runner account collision'
  /usr/bin/printf '%s\n' "$passwd_rows" | /usr/bin/awk -F: -v name="$user" -v uid="$uid" -v gid="$gid" '$1 == name && $3 == uid && $4 == gid && $6 == "/nonexistent" && $7 == "/usr/sbin/nologin" { ok = 1 } END { exit ok ? 0 : 1 }' || die 'runner account identity drift'
  [ "$(/usr/bin/id -G "$user" | /usr/bin/tr ' ' '\n' | /usr/bin/sort -u | /usr/bin/tr '\n' ' ')" = "$gid " ] || die 'runner supplementary group drift'
  /usr/bin/passwd -S "$user" | /usr/bin/awk '$2 == "L" { ok = 1 } END { exit ok ? 0 : 1 }' || die 'runner account must be locked'
  /usr/sbin/usermod --lock "$user"
}

main "$@"
