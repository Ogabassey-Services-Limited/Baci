#!/bin/sh
# shellcheck disable=SC2034 # Module state is consumed by recovery scanner functions after sourcing.

recovery_process_file_evidence() {
  pid=$1; process_root="$RECOVERY_PROC_ROOT/$pid"
  [ -e "$process_root" ] || [ -L "$process_root" ] || { /usr/bin/jq -cn '{state:"vanished"}'; return; }
  before=$(recovery_process_lifetime_marker "$pid") || review_required 'process file lifetime unavailable'
  cmdline="$process_root/cmdline"; executable="$process_root/exe"
  [ -f "$cmdline" ] && [ ! -L "$cmdline" ] || review_required 'process command line unavailable'
  command_snapshot=$(temp_path); /bin/cat -- "$cmdline" >"$command_snapshot" || { /bin/rm -f -- "$command_snapshot"; review_required 'process command line capture failed'; }
  if [ ! -L "$executable" ]; then
    state=$(sed 's/.*) //' "$process_root/stat" | awk '{print $1}')
    kthread=$(awk '/^Kthread:/{print $2; exit}' "$process_root/status")
    if [ ! -s "$command_snapshot" ] && { [ "$state" = Z ] || [ "$kthread" = 1 ]; }; then
      after=$(recovery_process_lifetime_marker "$pid") || { /bin/rm -f -- "$command_snapshot"; review_required 'process file lifetime unavailable'; }
      [ "$before" = "$after" ] || { /bin/rm -f -- "$command_snapshot"; review_required 'process file lifetime changed'; }
      /bin/rm -f -- "$command_snapshot"; /usr/bin/jq -cn --arg lifetime "$after" '{lifetimeSha256:$lifetime,state:"inert"}'; return
    fi
    /bin/rm -f -- "$command_snapshot"; review_required 'process executable link missing'
  fi
  observed=$(readlink -- "$executable") || { /bin/rm -f -- "$command_snapshot"; review_required 'process executable target unavailable'; }
  observed=${observed% (deleted)}; case "$observed" in /*) :;; *) /bin/rm -f -- "$command_snapshot"; review_required 'process executable path invalid';; esac
  executable_stat=$(stat -Lc '%d:%i:%u:%g:%a:%s' "$executable") || { /bin/rm -f -- "$command_snapshot"; review_required 'process executable identity failed'; }
  executable_sha=$(sha "$executable") || { /bin/rm -f -- "$command_snapshot"; review_required 'process executable digest failed'; }
  executable_match=''; if LC_ALL=C /usr/bin/grep -a -qiE 'ollama|11434' "$executable"; then executable_match=$executable_sha; else status=$?; [ "$status" -eq 1 ] || { /bin/rm -f -- "$command_snapshot"; review_required 'process executable scan failed'; }; fi
  arguments=$(temp_path); /usr/bin/perl -0ne 'BEGIN{$i=0} for(split(/\0/)){next if $i++==0; $p=$_; $p=$1 if $p=~/^[^=]+=((?:\/).*)$/; print "$p\n" if $p=~m{^/} && $p!~/[\r\n]/}' "$command_snapshot" >"$arguments" || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument parse failed'; }
  argument_entries='[]'; while IFS= read -r argument || [ -n "$argument" ]; do
    [ -e "$argument" ] || [ -L "$argument" ] || continue; [ -f "$argument" ] || continue
    real=$(readlink -f -- "$argument") || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument resolution failed'; }
    [ -f "$real" ] && [ ! -L "$real" ] || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument unsafe'; }
    argument_stat=$(stat -Lc '%d:%i:%u:%g:%a:%s' "$argument") || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument identity failed'; }
    argument_sha=$(sha "$argument") || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument digest failed'; }
    argument_match=''; if LC_ALL=C /usr/bin/grep -a -qiE 'ollama|11434' "$argument"; then argument_match=$argument_sha; else status=$?; [ "$status" -eq 1 ] || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument scan failed'; }; fi
    [ "$argument_stat" = "$(stat -Lc '%d:%i:%u:%g:%a:%s' "$argument")" ] && [ "$argument_sha" = "$(sha "$argument")" ] || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file argument changed'; }
    argument_entries=$(/usr/bin/jq -cn --argjson old "$argument_entries" --arg path "$(hash_text "$real")" --arg sha "$argument_sha" --arg identity "$(hash_text "$argument_stat")" --arg match "$argument_match" '$old + [{realPathSha256:$path,sha256:$sha,identitySha256:$identity} + (if $match == "" then {} else {matchingSha256:$match} end)]') || { /bin/rm -f -- "$command_snapshot" "$arguments"; die 'process file argument serialization failed'; }
  done <"$arguments"
  command_sha=$(sha "$cmdline") || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process command line digest failed'; }
  after=$(recovery_process_lifetime_marker "$pid") || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file lifetime unavailable'; }
  [ "$before" = "$after" ] && [ "$observed" = "$(readlink -- "$executable" | sed 's/ (deleted)$//')" ] && [ "$executable_stat" = "$(stat -Lc '%d:%i:%u:%g:%a:%s' "$executable")" ] && [ "$executable_sha" = "$(sha "$executable")" ] && [ "$command_sha" = "$(sha "$command_snapshot")" ] || { /bin/rm -f -- "$command_snapshot" "$arguments"; review_required 'process file evidence changed'; }
  /bin/rm -f -- "$command_snapshot" "$arguments"
  /usr/bin/jq -cn --arg lifetime "$after" --arg path "$(hash_text "$observed")" --arg sha "$executable_sha" --arg identity "$(hash_text "$executable_stat")" --arg match "$executable_match" --argjson arguments "$argument_entries" '{lifetimeSha256:$lifetime,executable:({pathSha256:$path,sha256:$sha,identitySha256:$identity} + (if $match == "" then {} else {matchingSha256:$match} end)),fileArguments:$arguments}'
}

recovery_process_files_match() { /usr/bin/printf '%s\n' "$1" | /usr/bin/jq -e '(.executable.matchingSha256? // "") != "" or any(.fileArguments[]?; (.matchingSha256? // "") != "")' >/dev/null; }

recovery_record_process_file_consumer() {
  evidence=$1; digest=$(hash_text "$(/usr/bin/printf '%s\n' "$evidence" | /usr/bin/jq -S -c .)") || die 'process file evidence digest failed'; recovery_sha256 "$digest" || die 'invalid process file evidence digest'; unknown=$(hash_text unknown) || die 'process file dependency digest failed'
  deps=$(/usr/bin/jq -cn --argjson old "$deps" --arg value "$unknown" --arg source "$digest" '$old + [{"key-name":("running-processes:files:" + $source),"endpoint-class":"unknown","normalized-value-sha256":$value,"source-path-sha256":$source,disposition:"consumer"}]') || die 'process file dependency record failed'
  consumer_evidence=$(/usr/bin/jq -cn --argjson old "$consumer_evidence" --arg sha "$digest" '$old + [{surface:"running-processes",classifiedPathSha256:$sha}]') || die 'process file evidence record failed'
  consumer_counts=$(/usr/bin/jq -cn --argjson old "$consumer_counts" '$old | map(if .surface == "running-processes" then .matchCount += 1 else . end)') || die 'process file count record failed'
}

record_running_process_files() {
  file=$1; process_rows=$(temp_path)
  awk 'NR==1 { if ($1=="PID" && $2=="PPID" && $3=="USER") next; bad=1; next } { pid=$1; ppid=$2; if (pid!~/^[0-9]+$/ || ppid!~/^[0-9]+$/ || NF<4) { bad=1; next } sub(/^[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+/,""); print pid " " ppid " " $0 } END { exit bad?2:0 }' "$file" >"$process_rows" || { /bin/rm -f -- "$process_rows"; review_required 'invalid process file inventory'; }
  RECOVERY_PROCESS_FILE=$process_rows; RECOVERY_SELF_PID=${RECOVERY_SELF_PID:-$$}; RECOVERY_SCANNER_PID_SET=''; if awk -v pid="$RECOVERY_SELF_PID" '$1 == pid { found=1 } END { exit(found ? 0 : 1) }' "$process_rows"; then recovery_build_scanner_ancestors; fi
  while IFS=' ' read -r pid ppid args || [ -n "$pid$ppid$args" ]; do
    [ -n "$pid" ] || continue; [ "$pid" = "$RECOVERY_SELF_PID" ] && continue; command=${args%% *}; rest=${args#"$command"}; base=${command##*/}
    evidence=$(recovery_process_file_evidence "$pid"); state=$(printf '%s\n' "$evidence" | /usr/bin/jq -r '.state // "present"') || { /bin/rm -f -- "$process_rows"; review_required 'invalid process file evidence'; }; [ "$state" = vanished ] && continue
    if recovery_process_files_match "$evidence"; then if recovery_is_scanner_ancestor "$pid" && recovery_is_reviewed_scanner_command "$pid" "$base" "$command" "$rest"; then :; else recovery_record_process_file_consumer "$evidence"; fi; fi
  done <"$process_rows"; /bin/rm -f -- "$process_rows"
}
