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
cron_inventory_anacrontab() { cron_inventory_override_or_default "${RETIRE_OLLAMA_ANACRONTAB:-}" /etc/anacrontab; }
cron_inventory_hourly_dir() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_HOURLY_DIR:-}" /etc/cron.hourly; }
cron_inventory_daily_dir() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_DAILY_DIR:-}" /etc/cron.daily; }
cron_inventory_weekly_dir() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_WEEKLY_DIR:-}" /etc/cron.weekly; }
cron_inventory_monthly_dir() { cron_inventory_override_or_default "${RETIRE_OLLAMA_CRON_MONTHLY_DIR:-}" /etc/cron.monthly; }
cron_inventory_valid_name() {
  case "$1" in ''|.*|*[!A-Za-z0-9_.-]*) return 1;; *) return 0;; esac
}
cron_inventory_run_parts_name() {
  case "$1" in ''|.*|*[!A-Za-z0-9_-]*) return 1;; *) return 0;; esac
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
cron_inventory_periodic_file_ok() {
  path=$1; cron_inventory_system_file_ok "$path" && [ -x "$path" ]
}
cron_inventory_optional_system_file() {
  path=$1 output=$2
  [ ! -e "$path" ] && [ ! -L "$path" ] && return 0
  cron_inventory_system_file_ok "$path" || return 1
  printf 'system\t-\t%s\n' "$path" >>"$output"
}
cron_inventory_periodic_dir() {
  directory=$1 output=$2
  [ ! -e "$directory" ] && [ ! -L "$directory" ] && return 0
  cron_inventory_system_dir_ok "$directory" || return 1
  count=0
  for path in "$directory"/*; do
    [ -e "$path" ] || [ -L "$path" ] || continue
    name=${path##*/}; cron_inventory_run_parts_name "$name" || return 1
    cron_inventory_periodic_file_ok "$path" || return 1
    count=$((count + 1)); [ "$count" -le 256 ] || return 1
    printf 'system-directory\t-\t%s\n' "$path" >>"$output" || return 1
  done
}
cron_inventory_command_targets() {
  kind=$1 source=$2 snapshot=$3; anacron=$(cron_inventory_anacrontab); system=$(cron_inventory_system_file); hourly=$(cron_inventory_hourly_dir); daily=$(cron_inventory_daily_dir); weekly=$(cron_inventory_weekly_dir); monthly=$(cron_inventory_monthly_dir)
  case "$kind:$source" in system:"$anacron") format=anacron;; system:*) format=system;; user:*) format=user;; system-directory:*) return 0;; *) return 2;; esac
  [ "$kind:$source" = "system:$system" ] && canonical_system=1 || canonical_system=0
  awk -v format="$format" -v canonical_system="$canonical_system" -v hourly="$hourly" -v daily="$daily" -v weekly="$weekly" -v monthly="$monthly" '
    function fixed_periodic(directory) {
      return directory == hourly || directory == daily || directory == weekly || directory == monthly
    }
    function periodic_delegation(field, directory) {
      if (!canonical_system || format != "system" || $(field - 1) != "root") return 0
      if (NF == field + 5 && $field == "cd" && $(field + 1) == "/" && $(field + 2) == "&&" && $(field + 3) == "run-parts" && $(field + 4) == "--report") return fixed_periodic($(field + 5))
      return NF == field + 11 && $field == "test" && $(field + 1) == "-x" && $(field + 2) == "/usr/sbin/anacron" && $(field + 3) == "||" && $(field + 4) == "(" && $(field + 5) == "cd" && $(field + 6) == "/" && $(field + 7) == "&&" && $(field + 8) == "run-parts" && $(field + 9) == "--report" && $(field + 11) == ")" && fixed_periodic($(field + 10))
    }
    function direct(field, command, i) {
      if (NF < field) { bad=1; return }
      command=$field
      if (command !~ /^\/[-A-Za-z0-9._+@%=]+(\/[-A-Za-z0-9._+@%=]+)*$/ || command ~ /(^|\/)\.\.?($|\/)/ || command ~ /\/(sh|bash|dash|env|node|perl|php|python|python[0-9.]*|ruby)$/) { bad=1; return }
      for (i=field+1; i<=NF; i++) if ($i ~ /[;&|<>()`$\\]/) { bad=1; return }
      print command
    }
    /^[[:space:]]*($|#)/ { next }
    /^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=/ { next }
    {
      if (periodic_delegation(7)) next
      if ($0 ~ /[;&|<>()`$\\]/) { bad=1; next }
      if ($1 ~ /^@[A-Za-z]+$/) { direct(format == "system" ? 3 : 2); next }
      direct(format == "system" ? 7 : (format == "anacron" ? 4 : 6))
    }
    END { exit bad ? 2 : 0 }
  ' "$snapshot"
}
cron_inventory_record_wrapper_consumers() {
  class=$1 kind=$2 source=$3 snapshot=$4; targets=$(temp_path)
  cron_inventory_command_targets "$kind" "$source" "$snapshot" >"$targets" || { rm -f "$targets"; return 2; }
  while IFS= read -r target || [ -n "$target" ]; do
    target=$(consumer_canonical_regular "$target") || { rm -f "$targets"; return 2; }; [ -x "$target" ] || { rm -f "$targets"; return 2; }
    captured=$(consumer_snapshot "$target") || { rm -f "$targets"; return 2; }; target_snapshot=${captured%%|*}; target_identity=${captured#*|}; target_content=$(sha "$target_snapshot") || { rm -f "$targets" "$target_snapshot"; return 2; }
    records=$(jq -cn --argjson old "$records" --arg class "$class-command" --arg path "$target" --arg sha "$target_content" --arg identity "$target_identity" '$old + [{class:$class,realPath:$path,sha256:$sha,identitySha256:$identity}]') || { rm -f "$targets" "$target_snapshot"; return 2; }
    record_consumers "$class" "$target_snapshot" cron-unapproved || { rm -f "$targets" "$target_snapshot"; return 2; }
    consumer_canonical_regular "$target" >/dev/null && [ "$target_identity" = "$(consumer_source_identity "$target")" ] || { rm -f "$targets" "$target_snapshot"; return 2; }; rm -f "$target_snapshot"
  done <"$targets"
  rm -f "$targets"
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
  cron_inventory_optional_system_file "$(cron_inventory_anacrontab)" "$output" || die 'unsafe anacrontab'
  cron_inventory_periodic_dir "$(cron_inventory_hourly_dir)" "$output" || die 'unsafe hourly cron directory'
  cron_inventory_periodic_dir "$(cron_inventory_daily_dir)" "$output" || die 'unsafe daily cron directory'
  cron_inventory_periodic_dir "$(cron_inventory_weekly_dir)" "$output" || die 'unsafe weekly cron directory'
  cron_inventory_periodic_dir "$(cron_inventory_monthly_dir)" "$output" || die 'unsafe monthly cron directory'
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
    load_consumer_scanners; real=$(consumer_canonical_regular "$path") || { rm -f "$manifest"; die 'unsafe cron source'; }; captured=$(consumer_snapshot "$path") || { rm -f "$manifest"; die 'cron source capture failed'; }; snapshot=${captured%%|*}; identity=${captured#*|}; [ "$identity" = "$(consumer_source_identity "$path")" ] && [ "$real" = "$(consumer_canonical_regular "$path")" ] || { rm -f "$manifest" "$snapshot"; die 'cron source changed during capture'; }; content=$(sha "$snapshot"); records=$(jq -cn --argjson old "$records" --arg class "$class" --arg path "$real" --arg sha "$content" --arg identity "$identity" '$old + [{class:$class,realPath:$path,sha256:$sha,identitySha256:$identity}]') || { rm -f "$manifest" "$snapshot"; die 'cron source record failed'; }; record_consumers "$class" "$snapshot" cron-unapproved || { rm -f "$manifest" "$snapshot"; die 'cron source consumer scan failed'; }; cron_inventory_record_wrapper_consumers "$class" "$kind" "$path" "$snapshot" || { rm -f "$manifest" "$snapshot"; die 'unsafe cron command target'; }; [ "$identity" = "$(consumer_source_identity "$path")" ] && [ "$real" = "$(consumer_canonical_regular "$path")" ] || { rm -f "$manifest" "$snapshot"; die 'cron source changed during capture'; }; rm -f "$snapshot"
  done <"$manifest"
  rm -f "$manifest"
}
