#!/bin/sh
# Consumer scanners are sourced by retire-ollama.sh after its trusted primitives.
parse_systemd_words() { printf '%s\n' "$1" | awk 'BEGIN{sq=0;dq=0;esc=0;started=0;word=""}{for(i=1;i<=length($0);i++){c=substr($0,i,1);if(esc){word=word c;started=1;esc=0;continue}if(c=="\\"&&!sq){esc=1;continue}if(c=="\""&&!sq){dq=!dq;started=1;continue}if(c=="\047"&&!dq){sq=!sq;started=1;continue}if(c~/[ \t]/&&!sq&&!dq){if(started){print word;word="";started=0}continue}word=word c;started=1}}END{if(esc||sq||dq)exit 2;if(started)print word}'; }
consumer_file_fingerprint() { path=$1; [ -f "$path" ] && [ ! -L "$path" ] || return 2; real=$(readlink -f -- "$path") || return 2; [ "$real" = "$path" ] || return 2; raw=$(temp_path); { stat -c '%d:%i:%f:%s:%u:%g:%a' "$path"; findmnt -no TARGET,SOURCE,FSTYPE,OPTIONS --target "$path"; } >"$raw" || { rm -f "$raw"; return 2; }; identity=$(sha "$raw"); rm -f "$raw"; printf '%s|%s|%s\n' "$path" "$(sha "$path")" "$identity"; }
consumer_matches() { grep -q -Ei 'ollama|11434' "$1"; }
consumer_canonical_regular() { path=$1; [ -f "$path" ] && [ ! -L "$path" ] || return 2; real=$(readlink -f -- "$path") || return 2; [ -f "$real" ] && [ ! -L "$real" ] || return 2; printf '%s\n' "$real"; }
nginx_include_paths() { awk '/^[[:space:]]*include[[:space:]]+/{line=$0;sub(/^[[:space:]]*include[[:space:]]+/,"",line);sub(/[[:space:]]*(#.*)?$/, "", line);if(line!~/;$/){bad=1;next}sub(/;$/, "", line);if(line==""||line~/[[:space:]]/||line!~ /^\//||("/" line "/")~/\/\.\.\//){bad=1;next}print line}END{exit bad?2:0}' "$1"; }
# shellcheck disable=SC2086 # Nginx includes require deliberate pathname expansion.
scan_nginx_file() {
  path=$(consumer_canonical_regular "$1") || return 2; grep -Fqx "$path" "$NGINX_SEEN" >/dev/null 2>&1 && return 0; printf '%s\n' "$path" >>"$NGINX_SEEN" || return 2
  if consumer_matches "$path"; then consumer_file_fingerprint "$path" || return 2; else status=$?; [ "$status" -eq 1 ] || return "$status"; fi
  includes=$(temp_path); nginx_include_paths "$path" >"$includes" || { status=$?; rm -f "$includes"; return "$status"; }
  while IFS= read -r pattern || [ -n "$pattern" ]; do case "$pattern" in *'*'*|*'?'*|*'['*) wildcard=1;; *) wildcard=0;; esac; set +f; set -- $pattern; set -f; [ -e "$1" ] || { [ "$wildcard" -eq 1 ] && continue; rm -f "$includes"; return 2; }; for candidate do target=$(consumer_canonical_regular "$candidate") || { rm -f "$includes"; return 2; }; if consumer_matches "$target"; then definition_record=$(consumer_file_fingerprint "$path") || { rm -f "$includes"; return 2; }; target_record=$(consumer_file_fingerprint "$target") || { rm -f "$includes"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$includes"; return "$status"; }; fi; scan_nginx_file "$target" || { status=$?; rm -f "$includes"; return "$status"; }; done; done <"$includes"; rm -f "$includes"
}
scan_nginx_definitions() { [ ! -e "$NGINX_ROOT" ] && return 0; [ -d "$NGINX_ROOT" ] && [ ! -L "$NGINX_ROOT" ] || return 2; NGINX_SEEN=$(temp_path); list=$(temp_path); find "$NGINX_ROOT" -type f >"$list" || { rm -f "$NGINX_SEEN" "$list"; return 2; }; while IFS= read -r path || [ -n "$path" ]; do scan_nginx_file "$path" || { status=$?; rm -f "$NGINX_SEEN" "$list"; return "$status"; }; done <"$list"; rm -f "$NGINX_SEEN" "$list"; }
compose_env_file_refs() {
  awk '
    function indent(s) { sub(/[^ ].*$/, "", s); return length(s) }
    function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
    function map_field(field, key, value) {
      field=trim(field); if (field !~ /^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:/) return 0
      key=field; sub(/[[:space:]]*:.*$/, "", key); value=field; sub(/^[^:]*:/, "", value); value=trim(value)
      if (key == "path") { if (path != "" || value == "") return 0; path=value; return 1 }
      if (key == "required") { if (required != "" || (value != "true" && value != "false")) return 0; required=value; return 1 }
      if (key == "format") { if (format != "" || (value != "default" && value != "raw")) return 0; format=value; return 1 }
      return 0
    }
    function map_fields(value, fields, count, i) { count=split(value, fields, /,/); for (i=1; i<=count; i++) if (!map_field(fields[i])) return 0; return 1 }
    function emit_map() { if (path == "") return 0; print (required == "false" ? "1:" : "0:") path; path=""; required=""; format=""; return 1 }
    function flow_maps(line, entries, count, i) {
      if (line !~ /^\[[[:space:]]*\{.*\}[[:space:]]*\]$/) return 0
      sub(/^\[[[:space:]]*\{/, "", line); sub(/\}[[:space:]]*\]$/, "", line); count=split(line, entries, /[[:space:]]*\}[[:space:]]*,[[:space:]]*\{[[:space:]]*/)
      for (i=1; i<=count; i++) { path=""; required=""; format=""; if (!map_fields(entries[i]) || !emit_map()) return 0 }; return 1
    }
    {
      if ($0 ~ /^[[:space:]]*#/ || $0 ~ /^[[:space:]]*$/) next; n=indent($0)
      if ($0 ~ /^[[:space:]]*env_file:[[:space:]]*/) {
        line=$0; sub(/^[[:space:]]*env_file:[[:space:]]*/, "", line); line=trim(line); level=n
        if (line == "") { inside=1; mapped=0; path=""; required=""; format=""; next }
        if (line ~ /^\[/) { if (!flow_maps(line)) bad=1; inside=0; next }
        if (line ~ /^\{/) { bad=1; next }; print "0:" line; inside=0; next
      }
      if (!inside) next
      if (n <= level) { if (mapped && !emit_map()) bad=1; inside=0; mapped=0; next }
      line=trim($0)
      if (line ~ /^-[[:space:]]+/) {
        if (mapped && !emit_map()) bad=1; mapped=0; path=""; required=""; format=""; sub(/^-[[:space:]]+/, "", line)
        if (line == "") { bad=1; next }
        if (line ~ /^\{.*\}$/) { sub(/^\{/, "", line); sub(/\}$/, "", line); if (!map_fields(line) || !emit_map()) bad=1; next }
        if (line ~ /^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:/) { mapped=1; if (!map_field(line)) bad=1; next }
        if (line ~ /^[\[{]/) { bad=1; next }; print "0:" line; next
      }
      if (!mapped || !map_field(line)) bad=1
    }
    END { if (inside && mapped && !emit_map()) bad=1; exit bad ? 2 : 0 }
  ' "$1"
}
compose_env_file_path() {
  definition=$1; optional=$2; value=$3; parsed=$(temp_path); parse_systemd_words "$value" >"$parsed" || { rm -f "$parsed"; return 2; }; count=$(wc -l <"$parsed"); [ "$count" -eq 1 ] || { rm -f "$parsed"; return 2; }; IFS= read -r item <"$parsed" || { rm -f "$parsed"; return 2; }; rm -f "$parsed"
  relative=0; base=''; case "$item" in '') return 2;; /*) target=/; item=${item#/}; while [ -n "$item" ]; do part=${item%%/*}; if [ "$item" = "$part" ]; then item=''; else item=${item#*/}; fi; [ -n "$part" ] && [ "$part" != . ] || return 2; case "$target" in /) target=/$part;; *) target=$target/$part;; esac; if [ -L "$target" ]; then link=$(readlink -- "$target") || return 2; case "$target:$link" in /var:private/var|/var:/private/var|/tmp:private/tmp|/tmp:/private/tmp|/bin:usr/bin|/bin:/usr/bin|/sbin:usr/sbin|/sbin:/usr/sbin|/lib:usr/lib|/lib:/usr/lib|/lib64:usr/lib64|/lib64:/usr/lib64) :;; *) return 2;; esac; fi; done;; *'..'*) return 2;; *) relative=1; base=$(readlink -f -- "$(dirname "$definition")") || return 2; item=${item#./}; target=$base; while [ -n "$item" ]; do part=${item%%/*}; if [ "$item" = "$part" ]; then item=''; else item=${item#*/}; fi; [ -n "$part" ] && [ "$part" != . ] || return 2; target="$target/$part"; [ ! -L "$target" ] || return 2; done;; esac
  [ -L "$target" ] && return 2; [ -e "$target" ] || { [ "$optional" = 1 ] && return 0; return 2; }; target=$(consumer_canonical_regular "$target") || return 2; if [ "$relative" -eq 1 ]; then case "$target" in "$base"/*) :;; *) return 2;; esac; fi; printf '%s\n' "$target"
}
scan_compose_environment_files() { definition=$1; refs=$(temp_path); compose_env_file_refs "$definition" >"$refs" || { status=$?; rm -f "$refs"; return "$status"; }; while IFS=: read -r optional ref || [ -n "$optional$ref" ]; do case "$optional" in 0|1) :;; *) rm -f "$refs"; return 2;; esac; targets=$(temp_path); compose_env_file_path "$definition" "$optional" "$ref" >"$targets" || { rm -f "$refs" "$targets"; return 2; }; while IFS= read -r target || [ -n "$target" ]; do if consumer_matches "$target"; then definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$refs" "$targets"; return 2; }; target_record=$(consumer_file_fingerprint "$target") || { rm -f "$refs" "$targets"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$refs" "$targets"; return "$status"; }; fi; done <"$targets"; rm -f "$targets"; done <"$refs"; rm -f "$refs"; }
scan_compose_definitions() { list=$(temp_path); for root in $COMPOSE_ROOTS; do [ ! -e "$root" ] && continue; [ -d "$root" ] && [ ! -L "$root" ] || { rm -f "$list"; return 2; }; find "$root" -maxdepth 5 -type f \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -o -name 'compose*.yml' -o -name 'compose*.yaml' -o -name 'Containerfile' \) >>"$list" || { rm -f "$list"; return 2; }; done; while IFS= read -r path || [ -n "$path" ]; do if consumer_matches "$path"; then consumer_file_fingerprint "$path" || { status=$?; rm -f "$list"; return "$status"; }; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list"; return "$status"; }; fi; case "$path" in *Containerfile) ;; *) scan_compose_environment_files "$path" || { status=$?; rm -f "$list"; return "$status"; };; esac; done <"$list"; rm -f "$list"; }
systemd_manager_call() { manager=$1; shift; case "$manager" in system) systemctl "$@";; user) systemctl --user --machine="$OWNER@.host" "$@";; *) return 2;; esac; }
systemd_runtime_inventory() { if [ "$#" -eq 1 ]; then manager=system; output=$1; elif [ "$#" -eq 2 ]; then manager=$1; output=$2; else return 2; fi; systemd_manager_call "$manager" list-units --all --full --no-legend --plain --no-pager >"$output"; }
systemd_runtime_has_unit() { awk -v unit="$2" '$1 == unit {found=1} END {exit !found}' "$1"; }
systemd_canonical_directory() { root=$1; [ -d "$root" ] || return 1; canonical=$(readlink -f -- "$root") || return 2; [ -d "$canonical" ] && [ ! -L "$canonical" ] || return 2; printf '%s\n' "$canonical"; }
systemd_owner_context() {
  row=$(getent passwd "$OWNER") || return 1
  printf '%s\n' "$row" | awk -F: -v owner="$OWNER" '$1 == owner && $3 ~ /^[0-9]+$/ && $3 != 0 && $4 ~ /^[0-9]+$/ && $6 ~ /^\// && $6 !~ /[[:space:]]/ && NF == 7 { valid++; uid=$3; home=$6 } END { if (NR == 1 && valid == 1) print uid ":" home; else exit 2 }'
}
systemd_user_roots() {
  context=$1; uid=${context%%:*}; home=${context#*:}; [ -n "$uid" ] && [ -n "$home" ] && [ "$uid:$home" = "$context" ] || return 2
  for root in "$home/.config/systemd/user" "$home/.local/share/systemd/user" /etc/systemd/user /run/systemd/user /usr/local/lib/systemd/user /usr/lib/systemd/user "/run/user/$uid/systemd/user"; do systemd_canonical_directory "$root" || { status=$?; [ "$status" -eq 1 ] && continue; return "$status"; }; done
}
systemd_user_manager_available() { context=$1; uid=${context%%:*}; runtime="/run/user/$uid"; bus="$runtime/bus"; if [ ! -e "$bus" ] && [ ! -L "$bus" ]; then return 1; fi; [ -d "$runtime" ] && [ ! -L "$runtime" ] && [ "$(stat -c '%u:%a' "$runtime")" = "$uid:700" ] || return 2; [ -S "$bus" ] && [ ! -L "$bus" ] && [ "$(stat -c '%u' "$bus")" = "$uid" ] || return 2; }
systemd_root_manifest() { output=$1; shift; for configured_root do root=$(systemd_canonical_directory "$configured_root") || { status=$?; [ "$status" -eq 1 ] && continue; return "$status"; }; if grep -Fqx -- "$root" "$output" >/dev/null 2>&1; then continue; else status=$?; [ "$status" -eq 1 ] || return "$status"; fi; printf '%s\n' "$root" >>"$output" || return 2; done; }
systemd_linked_definitions() {
  environment_files=$1; roots=$2; inventory=$(temp_path)
  while IFS= read -r root || [ -n "$root" ]; do find "$root" -maxdepth 1 -type l \( -name '*.service' -o -name '*.socket' -o -name '*.timer' \) >>"$inventory" || { status=$?; rm -f "$inventory"; return "$status"; }; done <"$roots"
  while IFS= read -r candidate || [ -n "$candidate" ]; do
    name=${candidate##*/}; case "$name" in ''|"$UNIT"|"$TIMER"|*[!A-Za-z0-9@_.-]*) rm -f "$inventory"; return 2;; esac
    target=$(readlink -- "$candidate") || { rm -f "$inventory"; return 2; }; case "$target" in /*) :;; *'..'*) rm -f "$inventory"; return 2;; *) continue;; esac; definition=$(consumer_canonical_regular "$target") || { rm -f "$inventory"; return 2; }
    if consumer_matches "$definition"; then consumer_file_fingerprint "$definition" || { rm -f "$inventory"; return 2; }; else status=$?; [ "$status" -eq 1 ] || { rm -f "$inventory"; return "$status"; }; fi
    if grep -H -E '^[[:space:]]*EnvironmentFile=' "$definition" >>"$environment_files"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$inventory"; return "$status"; }; fi
  done <"$inventory"
  rm -f "$inventory"
}
systemd_environment_targets() { path=$1; optional=$2; case "$path" in *'*'*|*'?'*|*'['*) case "$path" in *[[:space:]]*) return 2;; esac; set +f; set -- $path; set -f;; *) set -- "$path";; esac; [ -e "$1" ] || { [ "$optional" -eq 1 ] && return 0; return 2; }; for candidate do consumer_canonical_regular "$candidate" || return 2; done; }
scan_systemd_runtime_environment_files() { name=$1; value=$2; parsed=$(temp_path); parse_systemd_words "$value" >"$parsed" || { rm -f "$parsed"; return 2; }; while IFS= read -r item || [ -n "$item" ]; do optional=0; case "$item" in -/*) optional=1; item=${item#-};; /*) :;; *) rm -f "$parsed"; return 2;; esac; IFS= read -r annotation || { rm -f "$parsed"; return 2; }; case "$annotation" in '(ignore_errors=no)') [ "$optional" -eq 0 ] || { rm -f "$parsed"; return 2; };; '(ignore_errors=yes)') optional=1;; *) rm -f "$parsed"; return 2;; esac; targets=$(temp_path); systemd_environment_targets "$item" "$optional" >"$targets" || { rm -f "$parsed" "$targets"; return 2; }; while IFS= read -r target || [ -n "$target" ]; do [ "${RECOVERY_RECORDS+x}" = x ] && recovery_record_environment "$target" "$optional"; target_record=$(consumer_file_fingerprint "$target") || { rm -f "$parsed" "$targets"; return 2; }; if consumer_matches "$target" || printf '%s\n' "$value" | grep -q -Ei 'ollama|11434'; then printf '%s:%s|%s|%s|%s\n' "$name" "$target" "$(hash_text "EnvironmentFiles=$value")" "$(hash_text "$name")" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$parsed" "$targets"; return "$status"; }; fi; done <"$targets"; rm -f "$targets"; done <"$parsed"; rm -f "$parsed"; }
scan_systemd_runtime_consumers() { manager=${1:-system}; units=$(temp_path); properties=$(temp_path); systemd_runtime_inventory "$manager" "$units" || { status=$?; rm -f "$units" "$properties"; return "$status"; }; while read -r name _ || [ -n "$name" ]; do case "$name" in ''|"$UNIT"|"$TIMER") continue;; esac; if systemd_manager_call "$manager" show --property=Environment --property=EnvironmentFiles --property=ExecStart --no-pager -- "$name" >"$properties"; then :; else status=$?; refreshed=$(temp_path); systemd_runtime_inventory "$manager" "$refreshed" || { rm -f "$units" "$properties" "$refreshed"; return "$status"; }; if systemd_runtime_has_unit "$refreshed" "$name"; then rm -f "$units" "$properties" "$refreshed"; return "$status"; fi; rm -f "$refreshed"; continue; fi; while IFS= read -r property || [ -n "$property" ]; do case "$property" in EnvironmentFiles=*) scan_systemd_runtime_environment_files "$name" "${property#EnvironmentFiles=}" || { status=$?; rm -f "$units" "$properties"; return "$status"; };; *) if printf '%s\n' "$property" | grep -q -Ei 'ollama|11434'; then printf '%s:%s\n' "$name" "$(hash_text "$property")"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$units" "$properties"; return "$status"; }; fi;; esac; done <"$properties"; done <"$units"; rm -f "$units" "$properties"; }
scan_systemd_consumers() {
  list=$(temp_path); environment_files=$(temp_path); system_roots=$(temp_path); user_roots=$(temp_path); owner_context=''; user_runtime=0
  systemd_root_manifest "$system_roots" $SYSTEMD_ROOTS /run/systemd/system || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  if owner_context=$(systemd_owner_context); then systemd_user_roots "$owner_context" >"$user_roots" || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  while IFS= read -r root || [ -n "$root" ]; do
    if grep -r -l -Ei 'ollama|11434' "$root" >>"$list"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
    if grep -r -H -E '^[[:space:]]*EnvironmentFile=' "$root" >>"$environment_files"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  done <"$system_roots"
  while IFS= read -r root || [ -n "$root" ]; do
    if grep -r -l -Ei 'ollama|11434' "$root" >>"$list"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
    if grep -r -H -E '^[[:space:]]*EnvironmentFile=' "$root" >>"$environment_files"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  done <"$user_roots"
  systemd_linked_definitions "$environment_files" "$system_roots" || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  systemd_linked_definitions "$environment_files" "$user_roots" || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  if [ -n "$owner_context" ] && systemd_user_manager_available "$owner_context"; then user_runtime=1; else status=$?; [ -z "$owner_context" ] || [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  rm -f "$system_roots" "$user_roots"
  while IFS= read -r path || [ -n "$path" ]; do case "$path" in */"$UNIT"|*/"$UNIT".d/*|*/"$TIMER"|*/"$TIMER".d/*) ;; *) consumer_file_fingerprint "$path" || { status=$?; rm -f "$list" "$environment_files"; return "$status"; };; esac; done <"$list"
  rm -f "$list"
  while IFS=: read -r definition directive || [ -n "$definition$directive" ]; do
    case "$definition" in */"$UNIT"|*/"$UNIT".d/*|*/"$TIMER"|*/"$TIMER".d/*) continue;; esac
    value=${directive#*=}; parsed=$(temp_path); parse_systemd_words "$value" >"$parsed" || { status=$?; rm -f "$parsed"; return "$status"; }
    while IFS= read -r item || [ -n "$item" ]; do
      optional=0; case "$item" in -*) optional=1; item=${item#-};; esac
      case "$item" in /*) :;; *) rm -f "$parsed"; return 2;; esac
      targets=$(temp_path); systemd_environment_targets "$item" "$optional" >"$targets" || { rm -f "$parsed" "$targets"; return 2; }
      while IFS= read -r target || [ -n "$target" ]; do
        [ "${RECOVERY_RECORDS+x}" = x ] && recovery_record_environment "$target" "$optional"
        item_record=$(consumer_file_fingerprint "$target") || { rm -f "$parsed" "$targets"; return 2; }
        if consumer_matches "$target"; then
          definition_record=$(consumer_file_fingerprint "$definition") || { status=$?; rm -f "$parsed" "$targets"; return "$status"; }
          printf '%s|%s\n' "$definition_record" "$item_record"
        else
          status=$?; [ "$status" -eq 1 ] || { rm -f "$parsed" "$targets"; return "$status"; }
        fi
      done <"$targets"
      rm -f "$targets"
    done <"$parsed"
    rm -f "$parsed"
  done <"$environment_files"
  rm -f "$environment_files"
  scan_systemd_runtime_consumers system
  [ "$user_runtime" -eq 0 ] || scan_systemd_runtime_consumers user
}
# shellcheck disable=SC2094 # Snapshot names remain open only for read-before-cleanup.
container_bind_mount_consumers() {
  id=$1; mounts=$(temp_path); docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .Mounts}}' "$id" >"$mounts" || { status=$?; rm -f "$mounts"; return "$status"; }
  paths=$(temp_path); /usr/bin/jq -r 'if type != "array" or any(.[]; type != "object" or (.Type | type) != "string") then error("invalid mounts") else .[] | select(.Type == "bind") | if (.Source | type) != "string" or (.Destination | type) != "string" or (.Source | startswith("/") | not) or (.Destination | startswith("/") | not) then error("invalid bind mount") else [.Source, .Destination] | @tsv end end' "$mounts" >"$paths" || { rm -f "$mounts" "$paths"; return 2; }; rm -f "$mounts"
  tab=$(printf '\t')
  while IFS="$tab" read -r source destination || [ -n "$source$destination" ]; do
    [ -n "$source" ] && [ -n "$destination" ] || { rm -f "$paths"; return 2; }; [ -f "$source" ] || { rm -f "$paths"; return 2; }; [ ! -L "$source" ] || { rm -f "$paths"; return 2; }
    real=$(readlink -f -- "$source") || { rm -f "$paths"; return 2; }; [ "$real" = "$source" ] || { rm -f "$paths"; return 2; }
    if consumer_matches "$source"; then fingerprint=$(consumer_file_fingerprint "$source") || { rm -f "$paths"; return 2; }; printf 'container-bind-mount:%s:%s|%s\n' "$id" "$destination" "$fingerprint"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$paths"; return "$status"; }; fi
  done <"$paths"; rm -f "$paths"
}
# shellcheck disable=SC2094 # The open inventory snapshot remains readable after error cleanup unlinks it.
scan_container_rows() {
  scope=$1; raw=$(temp_path); if [ "$scope" = all ]; then docker --host "unix://$CANONICAL_DOCKER_SOCKET" ps -a --no-trunc --format '{{.ID}}' >"$raw"; else docker --host "unix://$CANONICAL_DOCKER_SOCKET" ps --no-trunc --format '{{.ID}}' >"$raw"; fi || { status=$?; rm -f "$raw"; return "$status"; }
  while IFS= read -r id || [ -n "$id" ]; do [ -n "$id" ] || continue; attempt=0; while :; do
    if name=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{.Name}}' "$id"); then
      if [ "$name" = "/$CONTAINER" ]; then bound=''; status=0
      elif line=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{.Id}} {{.Name}} {{.Path}} {{json .Args}} {{json .Config.Env}} {{json .Mounts}} {{json .HostConfig.PortBindings}} {{json .NetworkSettings.Ports}} {{json .NetworkSettings.Networks}}' "$id"); then
        if bound=$(container_bind_mount_consumers "$id"); then printf '%s' "$line" | /usr/bin/grep -Eqi 'ollama|11434' && printf '%s\n' "$line"; status=0; else status=$?; fi
      else status=$?
      fi
      if [ "$status" -eq 0 ]; then [ -z "$bound" ] || printf '%s\n' "$bound"; break; fi
    else status=$?; fi
    [ "$attempt" -eq 0 ] || { fresh=$(temp_path); if [ "$scope" = all ]; then docker --host "unix://$CANONICAL_DOCKER_SOCKET" ps -a --no-trunc --format '{{.ID}}' >"$fresh"; else docker --host "unix://$CANONICAL_DOCKER_SOCKET" ps --no-trunc --format '{{.ID}}' >"$fresh"; fi || { rm -f "$raw" "$fresh"; return "$status"; }; if grep -Fqx -- "$id" "$fresh"; then rm -f "$raw" "$fresh"; return "$status"; fi; rm -f "$fresh"; break; }; attempt=$((attempt + 1))
  done; done <"$raw"; rm -f "$raw"
}
