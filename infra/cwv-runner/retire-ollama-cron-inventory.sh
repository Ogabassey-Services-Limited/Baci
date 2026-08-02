#!/bin/sh
# Shared finite cron-source discovery for the privileged retirement and recovery scans.
cron_inventory_override_or_default() {
  value=$1 default=$2
  if [ "$(id -u)" -eq 0 ] || [ -z "${RETIRE_OLLAMA_TEST_BIN:-}" ]; then
    printf '%s\n' "$default"
  else
    printf '%s\n' "${value:-$default}"
  fi
}
cron_inventory_system_file() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_SYSTEM_FILE:-}" /etc/crontab; }
cron_inventory_system_dir() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_SYSTEM_DIR:-}" /etc/cron.d; }
cron_inventory_spool_dir() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_SPOOL_DIR:-}" /var/spool/cron/crontabs; }
cron_inventory_valid_name() {
  case "$1" in ''|.*|*[!A-Za-z0-9_.-]*) return 1;; *) return 0;; esac
}
cron_inventory_real_file() {
  path=$1; [ -f "$path" ] && [ ! -L "$path" ] || return 1
  real=$(readlink -f -- "$path") || return 1
  [ "$real" = "$path" ]
}
cron_inventory_system_file_ok() {
  path=$1; cron_inventory_real_file "$path" || return 1
  identity=$(stat -c '%u:%a' "$path") || return 1
  IFS=: read -r uid mode <<EOF
$identity
EOF
  case "$uid:$mode" in 0:[0-7][0-7][0-7]) :;; *) return 1;; esac
  [ $((0$mode & 022)) -eq 0 ]
}
cron_inventory_system_dir_ok() {
  path=$1; [ -d "$path" ] && [ ! -L "$path" ] || return 1
  real=$(readlink -f -- "$path") || return 1; [ "$real" = "$path" ] || return 1
  identity=$(stat -c '%u:%a' "$path") || return 1
  IFS=: read -r uid mode <<EOF
$identity
EOF
  case "$uid:$mode" in 0:[0-7][0-7][0-7]) :;; *) return 1;; esac
  [ $((0$mode & 022)) -eq 0 ]
}
cron_inventory_spool_dir_ok() {
  path=$1; [ -d "$path" ] && [ ! -L "$path" ] || return 1
  real=$(readlink -f -- "$path") || return 1; [ "$real" = "$path" ] || return 1
  expected_gid=$(cron_inventory_crontab_gid) || return 1
  identity=$(stat -c '%u:%g:%a' "$path") || return 1
  IFS=: read -r uid gid mode <<EOF
$identity
EOF
  [ "$uid:$gid:$mode" = "0:$expected_gid:1730" ]
}
cron_inventory_single_nss_record() {
  database=$1 key=$2; row=$(getent "$database" "$key") || return 1
  case "$row" in *'
'*) return 1;; esac
  printf '%s\n' "$row"
}
cron_inventory_crontab_gid() {
  row=$(cron_inventory_single_nss_record group crontab) || return 1
  IFS=: read -r name _ gid members extra <<EOF
$row
EOF
  [ -z "${extra:-}" ] && [ -z "$members" ] && [ "$name" = crontab ] || return 1
  case "$gid" in ''|*[!0-9]*) return 1;; esac
  printf '%s\n' "$gid"
}
cron_inventory_account_uid() {
  account=$1; cron_inventory_valid_name "$account" || return 1
  row=$(cron_inventory_single_nss_record passwd "$account") || return 1
  IFS=: read -r name _ uid gid _ _ _ extra <<EOF
$row
EOF
  [ -z "${extra:-}" ] && [ "$name" = "$account" ] || return 1
  case "$uid:$gid" in *[!0-9:]*|:*) return 1;; esac
  printf '%s\n' "$uid"
}
cron_inventory_user_file_ok() {
  account=$1 path=$2; cron_inventory_real_file "$path" || return 1
  expected=$(cron_inventory_account_uid "$account") || return 1
  identity=$(stat -c '%u:%a' "$path") || return 1
  IFS=: read -r uid mode <<EOF
$identity
EOF
  { [ "$uid" = "$expected" ] || [ "$uid" = 0 ]; } && [ "$mode" = 600 ]
}
cron_inventory_collect_external() {
  output=$1; : >"$output" || die 'cron inventory output failed'
  system=$(cron_inventory_system_file); cron_inventory_system_file_ok "$system" || die 'unsafe system crontab'
  printf 'system\t-\t%s\n' "$system" >>"$output" || die 'cron inventory output failed'
  system_dir=$(cron_inventory_system_dir); cron_inventory_system_dir_ok "$system_dir" || die 'unsafe system cron directory'
  count=0
  for path in "$system_dir"/*; do
    [ -e "$path" ] || [ -L "$path" ] || continue
    name=${path##*/}; cron_inventory_valid_name "$name" || die 'unsafe system cron entry'
    cron_inventory_system_file_ok "$path" || die 'unsafe system cron entry'
    count=$((count + 1)); [ "$count" -le 256 ] || die 'too many system cron entries'
    printf 'system-directory\t-\t%s\n' "$path" >>"$output" || die 'cron inventory output failed'
  done
  spool=$(cron_inventory_spool_dir); cron_inventory_spool_dir_ok "$spool" || die 'unsafe cron spool directory'
  count=0
  for path in "$spool"/*; do
    [ -e "$path" ] || [ -L "$path" ] || continue
    account=${path##*/}; cron_inventory_valid_name "$account" || die 'unsafe cron spool entry'
    cron_inventory_user_file_ok "$account" "$path" || die 'unbound cron spool entry'
    count=$((count + 1)); [ "$count" -le 256 ] || die 'too many cron spool entries'
    [ "$account" = "$OWNER" ] && continue
    printf 'user\t%s\t%s\n' "$account" "$path" >>"$output" || die 'cron inventory output failed'
  done
}
record_external_cron_sources() {
  manifest=$(temp_path); cron_inventory_collect_external "$manifest"
  while IFS="$(printf '\t')" read -r kind account path || [ -n "$kind$account$path" ]; do
    case "$kind" in system) class='system-crontab';; system-directory) class='system-cron-directory';; user) class='user-crontab';; *) rm -f "$manifest"; die 'invalid cron inventory entry';; esac
    [ -n "$path" ] || { rm -f "$manifest"; die 'invalid cron inventory entry'; }
    load_consumer_scanners; real=$(consumer_canonical_regular "$path") || { rm -f "$manifest"; die 'unsafe cron source'; }; captured=$(consumer_snapshot "$path") || { rm -f "$manifest"; die 'cron source capture failed'; }; snapshot=${captured%%|*}; identity=${captured#*|}; [ "$identity" = "$(consumer_source_identity "$path")" ] && [ "$real" = "$(consumer_canonical_regular "$path")" ] || { rm -f "$manifest" "$snapshot"; die 'cron source changed during capture'; }; content=$(sha "$snapshot"); records=$(jq -cn --argjson old "$records" --arg class "$class" --arg path "$real" --arg sha "$content" --arg identity "$identity" '$old + [{class:$class,realPath:$path,sha256:$sha,identitySha256:$identity}]') || { rm -f "$manifest" "$snapshot"; die 'cron source record failed'; }; record_consumers "$class" "$snapshot" cron-unapproved; rm -f "$snapshot"
  done <"$manifest"
  rm -f "$manifest"
}
