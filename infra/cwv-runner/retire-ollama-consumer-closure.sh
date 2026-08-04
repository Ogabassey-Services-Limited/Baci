#!/bin/sh
# Focused immutable closure helpers sourced by retire-ollama-consumers.sh.

systemd_default_binary_directories() {
  printf '%s\n' /usr/local/sbin /usr/local/bin /usr/sbin /usr/bin
}

systemd_simple_command_path() {
  command=$1
  case "$command" in ''|.|..|*/*) return 2;; esac
  directories=$(temp_path)
  systemd_default_binary_directories >"$directories" || { rm -f "$directories"; return 2; }
  while IFS= read -r directory || [ -n "$directory" ]; do
    case "$directory" in /*) :;; *) rm -f "$directories"; return 2;; esac
    candidate=$directory/$command
    if [ ! -e "$candidate" ] && [ ! -L "$candidate" ]; then continue; fi
    resolved=$(readlink -f -- "$candidate") || { rm -f "$directories"; return 2; }
    resolved=$(consumer_canonical_regular "$resolved") || { rm -f "$directories"; return 2; }
    [ -x "$resolved" ] || continue
    rm -f "$directories"; printf '%s\n' "$resolved"; return 0
  done <"$directories"
  rm -f "$directories"; return 2
}

systemd_quoted_command_paths() {
  value=$1
  while case "$value" in [-+!:@]*) :;; *) false;; esac; do value=${value#?}; done
  [ -n "$value" ] || return 1
  words=$(temp_path)
  parse_systemd_words "$value" >"$words" || { rm -f "$words"; return 2; }
  IFS= read -r command <"$words" || { rm -f "$words"; return 1; }
  case "$command" in
    /*) :;;
    *) command=$(systemd_simple_command_path "$command") || { rm -f "$words"; return 2; };;
  esac
  case "$command" in
    */sh|*/bash|*/dash|*/env|*/node|*/perl|*/php|*/python|*/python[0-9.]*|*/ruby)
      [ "$(wc -l <"$words")" -eq 2 ] || { rm -f "$words"; return 2; }
      { IFS= read -r _; IFS= read -r command; } <"$words" || { rm -f "$words"; return 2; }
      rm -f "$words"
      case "$command" in
        /*) consumer_canonical_regular "$command" >/dev/null 2>&1 || return 1; printf '%s\n' "$command";;
        *) return 2;;
      esac
      return
      ;;
  esac
  case "$command" in
    /*) command=$(consumer_canonical_regular "$command") || { rm -f "$words"; return 1; };;
    *) rm -f "$words"; return 2;;
  esac
  printf '%s\n' "$command" || { rm -f "$words"; return 2; }
  sed '1d' "$words" | while IFS= read -r argument || [ -n "$argument" ]; do
    case "$argument" in
      /*) argument_path=$argument;;
      -*=*)
        argument_name=${argument%%=*}; argument_path=${argument#*=}
        printf '%s\n' "$argument_name" | grep -Eq '^--?[A-Za-z0-9][A-Za-z0-9_.-]*$' || exit 2
        case "$argument_path" in /*) :;; *) continue;; esac
        ;;
      *) continue;;
    esac
    printf '%s\n' "$argument_path" | grep -Eq '^/[A-Za-z0-9._/-]+$' || exit 2
    case "$argument_path" in */../*|*/..|*/./*|*/.) exit 2;; esac
    if [ -e "$argument_path" ] || [ -L "$argument_path" ]; then
          canonical_argument=$(consumer_canonical_regular "$argument_path") || exit 2
          printf '%s\n' "$canonical_argument" || exit 2
    fi
  done
  status=$?; rm -f "$words"; return "$status"
}

systemd_quoted_command_path() {
  quoted_paths=$(temp_path)
  systemd_quoted_command_paths "$1" >"$quoted_paths" || { status=$?; rm -f "$quoted_paths"; return "$status"; }
  IFS= read -r quoted_command <"$quoted_paths" || { rm -f "$quoted_paths"; return 1; }
  rm -f "$quoted_paths"; printf '%s\n' "$quoted_command"
}

systemd_wrapper_exec_paths() {
  awk 'function trim(s){sub(/^[[:space:]]+/,"",s);sub(/[[:space:]]+$/,"",s);return s}function safe(path){return path~/^\/[A-Za-z0-9._\/-]+$/&&path!~/(^|\/)\.\.?($|\/)/}
    {line=trim($0);if(line==""||line~/^#/||line~/^(\.|source)[[:space:]]+/)next;sub(/[[:space:]]+#.*$/,"",line);count=split(line,parts,/[[:space:]]+/);candidate=(parts[1]~/^[A-Za-z_][A-Za-z0-9_]*=/||parts[1]=="exec"||parts[1]~/^\//);if(!candidate){if(line~/^[\047"`$]/||line~/(^|;)[[:space:]]*exec[[:space:]]/)bad=1;for(i=2;i<=count;i++)if(parts[i]~/^https?:\/\/[A-Za-z0-9._:-]+(\/[A-Za-z0-9._~%+,:@-]*)?$/){}else if(parts[i]~/\//)bad=1;next}if(line~/[\\\047"`$|&;<>(){}]/){bad=1;next};at=1;while(at<=count&&parts[at]~/^[A-Za-z_][A-Za-z0-9_]*=/){if(parts[at]!~/^[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9._:+,\/-]*$/){bad=1;next};value=parts[at];sub(/^[^=]*=/,"",value);if(value~/^\//){if(!safe(value))bad=1;else print value}else if(value~/\//)bad=1;at++}if(at>1){if(parts[at]!="exec"){bad=1;next};at++;explicit=1}else{explicit=(parts[at]=="exec");if(explicit)at++}if(at>count||!safe(parts[at])){bad=1;next};print parts[at];for(i=at+1;i<=count;i++)if(parts[i]~/^\//){if(!safe(parts[i]))bad=1;else print parts[i]}else if(parts[i]~/^--?[A-Za-z0-9][A-Za-z0-9_.-]*=/){path=parts[i];sub(/^[^=]*=/,"",path);if(path~/^\//){if(!safe(path))bad=1;else print path}else if(path~/\//)bad=1}else if(parts[i]~/^https?:\/\/[A-Za-z0-9._:-]+(\/[A-Za-z0-9._~%+,:@-]*)?$/){}else if(parts[i]~/\//)bad=1}
    END{exit bad?2:0}' "$1"
}

systemd_rooted_regular_target() {
  rooted_regular_root=$1; rooted_regular_path=$2
  [ "$rooted_regular_root" = / ] && rooted_regular_candidate=$rooted_regular_path || rooted_regular_candidate=$rooted_regular_root$rooted_regular_path
  if consumer_canonical_regular "$rooted_regular_candidate" >/dev/null 2>&1; then printf '%s\n' "$rooted_regular_candidate"; return 0; fi
  case "$rooted_regular_path" in /bin/*) rooted_alias=/bin; rooted_usr=/usr/bin; rooted_rest=${rooted_regular_path#/bin/};; /sbin/*) rooted_alias=/sbin; rooted_usr=/usr/sbin; rooted_rest=${rooted_regular_path#/sbin/};; /lib/*) rooted_alias=/lib; rooted_usr=/usr/lib; rooted_rest=${rooted_regular_path#/lib/};; /lib64/*) rooted_alias=/lib64; rooted_usr=/usr/lib64; rooted_rest=${rooted_regular_path#/lib64/};; *) return 2;; esac
  [ "$rooted_regular_root" = / ] && rooted_alias_path=$rooted_alias || rooted_alias_path=$rooted_regular_root$rooted_alias
  [ -L "$rooted_alias_path" ] || return 2; rooted_link=$(readlink -- "$rooted_alias_path") || return 2
  case "$rooted_link" in "${rooted_usr#/}"|"$rooted_usr") :;; *) return 2;; esac
  [ "$rooted_regular_root" = / ] && rooted_expected=$rooted_usr/$rooted_rest || rooted_expected=$rooted_regular_root$rooted_usr/$rooted_rest
  consumer_canonical_regular "$rooted_expected"
}

systemd_credential_file_directives() {
  awk 'function emit(s){sub(/^[[:space:]]*/,"",s);if(s~/^LoadCredential(Encrypted)?=/)print s}
    {line=$0;if(joined!="")line=joined " " line;if(line~/\\$/){sub(/\\$/,"",line);joined=line;next}emit(line);joined=""}
    END{if(joined!="")exit 2}' "$1"
}

systemd_credential_targets() {
  value=$1; parsed=$(temp_path)
  parse_systemd_words "$value" >"$parsed" || { rm -f "$parsed"; return 2; }
  while IFS= read -r item || [ -n "$item" ]; do
    credential_name=${item%%:*}; credential_source=${item#*:}; [ "$credential_source" != "$item" ] || { rm -f "$parsed"; return 2; }
    printf '%s\n' "$credential_name" | grep -Eq '^[A-Za-z0-9._-]+$' || { rm -f "$parsed"; return 2; }
    case "$credential_source" in /*) :;; *) rm -f "$parsed"; return 2;; esac
    consumer_canonical_regular "$credential_source" || { rm -f "$parsed"; return 2; }
  done <"$parsed"
  rm -f "$parsed"
}

systemd_static_credentials() {
  definition=$1; directives=$(temp_path)
  systemd_credential_file_directives "$definition" >"$directives" || { status=$?; rm -f "$directives"; return "$status"; }
  while IFS= read -r directive || [ -n "$directive" ]; do
    credential_directive=${directive%%=*}
    targets=$(temp_path); systemd_credential_targets "${directive#*=}" >"$targets" || { rm -f "$directives" "$targets"; return 2; }
    while IFS= read -r target || [ -n "$target" ]; do
      if [ "$credential_directive" = LoadCredentialEncrypted ]; then
        target_record=$(consumer_file_fingerprint "$target") || { rm -f "$directives" "$targets"; return 2; }
        definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$directives" "$targets"; return 2; }
        printf '%s|%s\n' "$definition_record" "$target_record"
      elif target_record=$(consumer_matched_fingerprint "$target"); then
        definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$directives" "$targets"; return 2; }
        printf '%s|%s\n' "$definition_record" "$target_record"
      else status=$?; [ "$status" -eq 1 ] || { rm -f "$directives" "$targets"; return "$status"; }; fi
    done <"$targets"; rm -f "$targets"
  done <"$directives"; rm -f "$directives"
}

scan_systemd_runtime_credentials() {
  name=$1; value=$2; targets=$(temp_path)
  systemd_credential_targets "$value" >"$targets" || { rm -f "$targets"; return 2; }
  while IFS= read -r target || [ -n "$target" ]; do
    if target_record=$(consumer_matched_fingerprint "$target"); then
      printf '%s:%s|%s\n' "$name" "$(hash_text "LoadCredential=$value")" "$target_record"
    else status=$?; [ "$status" -eq 1 ] || { rm -f "$targets"; return "$status"; }; fi
  done <"$targets"; rm -f "$targets"
}

scan_systemd_runtime_encrypted_credentials() {
  name=$1; value=$2; targets=$(temp_path)
  systemd_credential_targets "$value" >"$targets" || { rm -f "$targets"; return 2; }
  while IFS= read -r target || [ -n "$target" ]; do
    target_record=$(consumer_file_fingerprint "$target") || { rm -f "$targets"; return 2; }
    printf '%s:%s|%s\n' "$name" "$(hash_text "LoadCredentialEncrypted=$value")" "$target_record"
  done <"$targets"; rm -f "$targets"
}

systemd_pass_environment_names() {
  value=$1; output=$2; parsed=$(temp_path)
  parse_systemd_words "$value" >"$parsed" || { rm -f "$parsed"; return 2; }
  awk '/^[A-Za-z_][A-Za-z0-9_]*$/{if(seen[$0]++||++count>256)bad=1;else print;next}{bad=1}END{exit bad?2:0}' "$parsed" >"$output"
  status=$?; rm -f "$parsed"; return "$status"
}

scan_systemd_pass_environment() {
  manager=$1; name=$2; value=$3; names=$(temp_path); before=$(temp_path); after=$(temp_path); projection=$(temp_path)
  systemd_pass_environment_names "$value" "$names" || { rm -f "$names" "$before" "$after" "$projection"; return 2; }
  [ -s "$names" ] || { rm -f "$names" "$before" "$after" "$projection"; return 0; }
  systemd_manager_call "$manager" show-environment >"$before" || { status=$?; rm -f "$names" "$before" "$after" "$projection"; return "$status"; }
  awk 'FNR==NR{wanted[$0]=1;next}{if(length($0)>4096||$0~/[\r\t]/||index($0,"=")==0){bad=1;next};key=$0;sub(/=.*/,"",key);if(key!~/^[A-Za-z_][A-Za-z0-9_]*$/||seen[key]++||++count>1024){bad=1;next};if(key in wanted)print}END{exit bad?2:0}' "$names" "$before" >"$projection" || { rm -f "$names" "$before" "$after" "$projection"; return 2; }
  systemd_manager_call "$manager" show-environment >"$after" || { status=$?; rm -f "$names" "$before" "$after" "$projection"; return "$status"; }
  cmp -s "$before" "$after" || { rm -f "$names" "$before" "$after" "$projection"; return 2; }
  if consumer_matches "$projection"; then manager_sha=$(sha "$before") || { rm -f "$names" "$before" "$after" "$projection"; return 2; }; projection_sha=$(sha "$projection") || { rm -f "$names" "$before" "$after" "$projection"; return 2; }; printf '%s:manager-environment|%s|%s\n' "$name" "$manager_sha" "$projection_sha"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$names" "$before" "$after" "$projection"; return "$status"; }; fi
  rm -f "$names" "$before" "$after" "$projection"
}

dockerfile_base_images() {
  awk '
    /^[[:space:]]*#/ || /^[[:space:]]*$/ {next}
    {line=$0;sub(/^[[:space:]]*/,"",line);instruction=line;sub(/[[:space:]].*$/,"",instruction);if(tolower(instruction)!="from")next
     sub(/^[^[:space:]]+[[:space:]]+/,"",line);if(line~/[\\\047"`$|&;<>(){}\[\]]/){bad=1;next}
     count=split(line,part,/[[:space:]]+/);at=1;if(part[at]~/^--platform=/){if(part[at]!~/^--platform=[-A-Za-z0-9_.\/:]+$/){bad=1;next};at++}
     image=part[at++];if(image!~/^[A-Za-z0-9][A-Za-z0-9._\/@:-]*$/){bad=1;next};alias=""
     if(at<=count){if(tolower(part[at])!="as"||at+1!=count||part[at+1]!~/^[A-Za-z0-9_.-]+$/){bad=1;next};alias=tolower(part[at+1])}
     key=tolower(image);if(key!="scratch"&&!stage[key])print image;if(alias!=""){if(stage[alias])bad=1;stage[alias]=1}}
    END{exit bad?2:0}' "$1"
}

compose_cron_command_lines() {
  cron_kind=$1; cron_source=$2; cron_snapshot=$3; cron_anacron=$(cron_inventory_anacrontab); cron_system_dir=$(cron_inventory_system_dir)
  case "$cron_kind:$cron_source" in system:"$cron_anacron") cron_field=4;; system:*) cron_field=7;; user:*) cron_field=6;; system-directory:*) [ "${cron_source%/*}" = "$cron_system_dir" ] || return 0; cron_field=7;; *) return 2;; esac
  awk -v field="$cron_field" '/^[[:space:]]*($|#)/{next}/^[[:space:]]*[A-Za-z_][A-Za-z0-9_]*=/{next}{if(NF<field){bad=1;next};line=$field;for(i=field+1;i<=NF;i++)line=line " " $i;print line}END{exit bad?2:0}' "$cron_snapshot"
}

compose_cron_cli_tokens() {
  awk 'NR==1{if($0!="/usr/bin/flock"){plain=1;print;next};flock=1;next}plain{print;next}NR==2{if($0!="-n")bad=1;next}NR==3{if($0!~/^\/run\/[A-Za-z0-9._\/-]+$/||$0~/(^|\/)\.\.?($|\/)/)bad=1;next}NR==4{if($0!~/^\/[A-Za-z0-9._\/-]+$/||$0~/(^|\/)\.\.?($|\/)/)bad=1;else print;next}{print}END{if(flock&&NR<4)bad=1;exit bad?2:0}' "$1"
}

compose_cron_reference_inventory() {
  cron_output=$1; cron_manifest=${RETIRE_OLLAMA_CRON_SOURCES:-${RECOVERY_EXTERNAL_CRON_SOURCES:-}}; [ -n "$cron_manifest" ] || return 0; cron_manifest_captured=$(consumer_snapshot "$cron_manifest") || return 2; cron_manifest_snapshot=${cron_manifest_captured%%|*}; cron_manifest_identity=${cron_manifest_captured#*|}; cron_targets=$(temp_path); cron_commands=$(temp_path); cron_tokens=$(temp_path); cron_cli_tokens=$(temp_path)
  while IFS="$(printf '\t')" read -r cron_kind _ cron_source || [ -n "$cron_kind$cron_source" ]; do cron_captured=$(consumer_snapshot "$cron_source") || { rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens"; return 2; }; cron_snapshot=${cron_captured%%|*}; cron_identity=${cron_captured#*|}; cron_inventory_command_targets "$cron_kind" "$cron_source" "$cron_snapshot" >"$cron_targets" || { rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens" "$cron_snapshot"; return 2; }; if [ -s "$cron_targets" ]; then compose_cron_command_lines "$cron_kind" "$cron_source" "$cron_snapshot" >"$cron_commands" || { rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens" "$cron_snapshot"; return 2; }; while IFS= read -r cron_command || [ -n "$cron_command" ]; do parse_systemd_words "$cron_command" >"$cron_tokens" && compose_cron_cli_tokens "$cron_tokens" >"$cron_cli_tokens" && compose_cli_file_refs "$cron_cli_tokens" >>"$cron_output" || { rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens" "$cron_snapshot"; return 2; }; done <"$cron_commands"; fi; consumer_canonical_regular "$cron_source" >/dev/null && [ "$cron_identity" = "$(consumer_source_identity "$cron_source")" ] || { rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens" "$cron_snapshot"; return 2; }; rm -f "$cron_snapshot"; done <"$cron_manifest_snapshot"
  consumer_canonical_regular "$cron_manifest" >/dev/null && [ "$cron_manifest_identity" = "$(consumer_source_identity "$cron_manifest")" ] || { rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens"; return 2; }; rm -f "$cron_manifest_snapshot" "$cron_targets" "$cron_commands" "$cron_tokens" "$cron_cli_tokens"
}

container_wrapper_exec_paths() {
  awk 'function trim(value){sub(/^[[:space:]]+/,"",value);sub(/[[:space:]]+$/,"",value);return value}function safe(path){return path~/^\/[A-Za-z0-9._\/-]+$/&&path!~/(^|\/)\.\.?($|\/)/}{line=trim($0);if(line==""||line~/^#/)next;sub(/[[:space:]]+#.*$/,"",line);count=split(line,parts,/[[:space:]]+/);candidate=(parts[1]~/^[A-Za-z_][A-Za-z0-9_]*=/||parts[1]=="exec"||parts[1]~/^\//);if(!candidate){if(line~/^[\047"`$]/||line~/(^|;)[[:space:]]*exec[[:space:]]/)bad=1;next}if(line~/[\\\047"`$|&;<>(){}]/){bad=1;next};at=1;while(at<=count&&parts[at]~/^[A-Za-z_][A-Za-z0-9_]*=/){if(parts[at]!~/^[A-Za-z_][A-Za-z0-9_]*=[A-Za-z0-9._:+,\/-]*$/){bad=1;next};value=parts[at];sub(/^[^=]*=/,"",value);if(value~/^\//){if(!safe(value))bad=1;else print value}else if(value~/\//)bad=1;at++}if(at>1){if(parts[at]!="exec"){bad=1;next};at++;explicit=1}else{explicit=(parts[at]=="exec");if(explicit)at++}if(at>count||!safe(parts[at])){bad=1;next};for(i=at;i<=count;i++)if(parts[i]~/^\//){if(!safe(parts[i]))bad=1;else print parts[i]}else if(parts[i]~/^--?[A-Za-z0-9][A-Za-z0-9_.-]*=/){path=parts[i];sub(/^[^=]*=/,"",path);if(path~/^\//){if(!safe(path))bad=1;else print path}else if(path~/\//)bad=1}else if(parts[i]~/^https?:\/\/[A-Za-z0-9._:-]+(\/[A-Za-z0-9._~%+,:@-]*)?$/){}else if(parts[i]~/\//)bad=1}END{exit bad?2:0}' "$1"
}

container_wrapper_source_paths() {
  awk 'function trim(value){sub(/^[[:space:]]+/,"",value);sub(/[[:space:]]+$/,"",value);return value}function safe(path){return path~/^\/[A-Za-z0-9._\/-]+$/&&path!~/(^|\/)\.\.?($|\/)/}function inspect(value,line,source_like){line=trim(value);if(line==""||line~/^#/)return;sub(/[[:space:]]+#.*$/,"",line);line=trim(line);source_like=line~/(^|[^A-Za-z0-9_])source([^A-Za-z0-9_]|$)/||line~/(^|[^A-Za-z0-9_])\.[[:space:]]/;if(source_like&&line~/[\\\047"`$]/){bad=1;return}if(line~/^\.[[:space:]]+/)sub(/^\.[[:space:]]+/,"",line);else if(line~/^source[[:space:]]+/)sub(/^source[[:space:]]+/,"",line);else{if(line~/(^|[[:space:];&|(){}])(\.|source)([[:space:]]|$)/)bad=1;return}line=trim(line);if(!safe(line))bad=1;else print line}{line=$0;if(continuing)line=joined line;slashes=0;for(i=length(line);i>0&&substr(line,i,1)=="\\";i--)slashes++;if(slashes%2){sub(/\\$/,"",line);joined=line;continuing=1;next}joined="";continuing=0;inspect(line)}END{if(continuing)bad=1;exit bad?2:0}' "$1"
}

container_argument_cleanup() {
  cleanup_status=0
  for cleanup_path in "${argument_json:-}" "${argument_again:-}" "${argument_roots:-}" "${argument_emitted:-}" "${argument_queue:-}" "${argument_seen:-}" "${argument_bound:-}" "${first:-}" "${second:-}" "${argument_execs:-}" "${argument_sources:-}"; do [ -z "$cleanup_path" ] || rm -f -- "$cleanup_path" || cleanup_status=2; done
  return "$cleanup_status"
}

container_argument_consumers_run() {
  argument_id=$1; argument_configuration=$2; argument_rest=${argument_configuration#* }; argument_rest=${argument_rest#* }; argument_path=${argument_rest%% *}; [ "$argument_path" != "$argument_rest" ] || return 2; argument_rest=${argument_rest#* }; argument_json=$(temp_path); argument_again=$(temp_path); argument_roots=$(temp_path); argument_emitted=$(temp_path); case "$argument_path" in /*) printf '%s\n' "$argument_path" | grep -Eq '^/[A-Za-z0-9._/-]+$' && ! printf '%s\n' "$argument_path" | grep -Eq '(^|/)\.\.?($|/)' || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted"; return 2; }; printf '%s\n' "$argument_path" >>"$argument_roots";; esac
  case "$argument_rest" in '[] '*) :;; *) docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .Args}}' "$argument_id" >"$argument_json" && docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .Args}}' "$argument_id" >"$argument_again" && cmp -s "$argument_json" "$argument_again" || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted"; return 2; }; /usr/bin/jq -er 'if type != "array" or any(.[]; type != "string") then error("invalid arguments") else [.[] | select(startswith("/")) | if test("^/[A-Za-z0-9._/-]+$") and (test("(^|/)\\.\\.?(/|$)")|not) then . else error("unsafe argument path") end] | unique[] end' "$argument_json" >>"$argument_roots" || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted"; return 2; };; esac; sort -u "$argument_roots" -o "$argument_roots" || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted"; return 2; }
  argument_root_count=0
  while IFS= read -r argument_root || [ -n "$argument_root" ]; do
    argument_root_count=$((argument_root_count + 1)); [ "$argument_root_count" -le 256 ] || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted"; return 2; }
    argument_queue=$(temp_path); argument_seen=$(temp_path); argument_bound=$(temp_path); printf 'exec\t%s\n' "$argument_root" >"$argument_queue" || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted" "$argument_queue" "$argument_seen" "$argument_bound"; return 2; }; argument_count=0; argument_matches=0; argument_queue_tab=$(printf '\t')
    while IFS="$argument_queue_tab" read -r argument_origin argument_path || [ -n "$argument_origin$argument_path" ]; do
      case "$argument_origin" in exec|source) :;; *) return 2;; esac; argument_seen_key=$argument_origin:$argument_path
      if grep -Fqx -- "$argument_seen_key" "$argument_seen" >/dev/null 2>&1; then continue; else argument_status=$?; [ "$argument_status" -eq 1 ] || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted" "$argument_queue" "$argument_seen" "$argument_bound"; return "$argument_status"; }; fi
      printf '%s\n' "$argument_seen_key" >>"$argument_seen" || return 2; argument_count=$((argument_count + 1)); [ "$argument_count" -le 256 ] || { rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted" "$argument_queue" "$argument_seen" "$argument_bound"; return 2; }
      first=$(temp_path); second=$(temp_path); first=$(readlink -f -- "$first") && second=$(readlink -f -- "$second") || { rm -f "$first" "$second"; return 2; }; rm -f "$first" "$second"; [ "$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .State.Running}}' "$argument_id")" = false ] || return 2
      docker --host "unix://$CANONICAL_DOCKER_SOCKET" cp "$argument_id:$argument_path" "$first" >/dev/null 2>&1 && docker --host "unix://$CANONICAL_DOCKER_SOCKET" cp "$argument_id:$argument_path" "$second" >/dev/null 2>&1 || return 2
      consumer_canonical_regular "$first" >/dev/null && consumer_canonical_regular "$second" >/dev/null || return 2; first_record="$(sha "$first")|$(stat -c '%f:%s:%u:%g:%a' "$first")"; second_record="$(sha "$second")|$(stat -c '%f:%s:%u:%g:%a' "$second")"; [ "$first_record" = "$second_record" ] && [ "$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .State.Running}}' "$argument_id")" = false ] || return 2
      printf '%s\t%s\n' "$argument_path" "$first_record" >>"$argument_bound" || return 2
      if consumer_matches "$first"; then argument_matches=$((argument_matches + 1)); else argument_status=$?; [ "$argument_status" -eq 1 ] || return "$argument_status"; fi
      argument_execs=$(temp_path); argument_sources=$(temp_path); argument_shebang=0; [ "$(dd if="$first" bs=2 count=1 2>/dev/null)" = '#!' ] && argument_shebang=1; if [ "$argument_shebang" -eq 1 ]; then container_wrapper_exec_paths "$first" >"$argument_execs" || { rm -f "$first" "$second" "$argument_execs" "$argument_sources"; return 2; }; fi; if [ "$argument_shebang" -eq 1 ] || [ "$argument_origin" = source ]; then container_wrapper_source_paths "$first" >"$argument_sources" || { rm -f "$first" "$second" "$argument_execs" "$argument_sources"; return 2; }; fi; while IFS= read -r argument_exec || [ -n "$argument_exec" ]; do printf 'exec\t%s\n' "$argument_exec" >>"$argument_queue" || return 2; done <"$argument_execs"; while IFS= read -r argument_source || [ -n "$argument_source" ]; do printf 'source\t%s\n' "$argument_source" >>"$argument_queue" || return 2; done <"$argument_sources"; rm -f "$first" "$second" "$argument_execs" "$argument_sources"
    done <"$argument_queue"
    if [ "$argument_matches" -gt 0 ]; then argument_tab=$(printf '\t'); while IFS="$argument_tab" read -r argument_path argument_record || [ -n "$argument_path$argument_record" ]; do if grep -Fqx -- "$argument_path" "$argument_emitted" >/dev/null 2>&1; then continue; else argument_status=$?; [ "$argument_status" -eq 1 ] || return "$argument_status"; fi; printf 'container-argument:%s:%s|%s\n' "$argument_id" "$argument_path" "$argument_record"; printf '%s\n' "$argument_path" >>"$argument_emitted" || return 2; done <"$argument_bound"; fi
    rm -f "$argument_queue" "$argument_seen" "$argument_bound"
  done <"$argument_roots"
  rm -f "$argument_json" "$argument_again" "$argument_roots" "$argument_emitted"
}

container_argument_consumers() {
  argument_json=''; argument_again=''; argument_roots=''; argument_emitted=''; argument_queue=''; argument_seen=''; argument_bound=''; first=''; second=''; argument_execs=''; argument_sources=''
  if container_argument_consumers_run "$@"; then argument_run_status=0; else argument_run_status=$?; fi
  if container_argument_cleanup; then argument_cleanup_status=0; else argument_cleanup_status=$?; fi
  [ "$argument_run_status" -eq 0 ] || return "$argument_run_status"
  return "$argument_cleanup_status"
}

scan_compose_build_images() {
  definition=$1; dockerfile=$2; refs=$(temp_path)
  dockerfile_base_images "$dockerfile" >"$refs" || { status=$?; rm -f "$refs"; return "$status"; }
  while IFS= read -r image || [ -n "$image" ]; do
    configuration=$(compose_image_configuration "$image") || { status=$?; rm -f "$refs"; return "$status"; }
    [ "$configuration" = "$(compose_image_configuration "$image")" ] || { rm -f "$refs"; return 2; }
    if printf '%s\n' "$configuration" | grep -Eqi 'ollama|11434'; then
      definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$refs"; return 2; }
      dockerfile_record=$(consumer_file_fingerprint "$dockerfile") || { rm -f "$refs"; return 2; }
      printf 'compose-build-image:%s|%s|%s\n' "$definition_record" "$dockerfile_record" "$configuration"
    else status=$?; [ "$status" -eq 1 ] || { rm -f "$refs"; return "$status"; }; fi
  done <"$refs"; rm -f "$refs"
}

container_configuration_network_mode() {
  configuration=$1; network_mode=${configuration##* }
  [ "$network_mode" != "$configuration" ] || return 2
  printf '%s\n' "$network_mode" | /usr/bin/jq -er '
    if type == "string" and test("^(default|bridge|host|none|container:[A-Za-z0-9][A-Za-z0-9_.-]{0,127}|[A-Za-z0-9][A-Za-z0-9_.-]{0,127})$")
    then . else error("invalid network mode") end' >/dev/null || return 2
}
