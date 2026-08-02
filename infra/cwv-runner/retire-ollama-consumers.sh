#!/bin/sh
# Consumer scanners are sourced by retire-ollama.sh after its trusted primitives.
CONTAINER_STABILITY_ATTEMPTS=3
parse_systemd_words() { printf '%s\n' "$1" | awk 'BEGIN{sq=0;dq=0;esc=0;started=0;word=""}{for(i=1;i<=length($0);i++){c=substr($0,i,1);if(esc){word=word c;started=1;esc=0;continue}if(c=="\\"&&!sq){esc=1;continue}if(c=="\""&&!sq){dq=!dq;started=1;continue}if(c=="\047"&&!dq){sq=!sq;started=1;continue}if(c~/[ \t]/&&!sq&&!dq){if(started){print word;word="";started=0}continue}word=word c;started=1}}END{if(esc||sq||dq)exit 2;if(started)print word}'; }
consumer_source_identity() { path=$1; raw=$(temp_path); { stat -c '%d:%i:%f:%s:%u:%g:%a' "$path"; findmnt -no TARGET,SOURCE,FSTYPE,OPTIONS --target "$path"; sha "$path"; } >"$raw" || { rm -f "$raw"; return 2; }; identity=$(sha "$raw"); rm -f "$raw"; printf '%s\n' "$identity"; }
consumer_snapshot() { path=$1; consumer_canonical_regular "$path" >/dev/null || return 2; identity=$(consumer_source_identity "$path") || return 2; snapshot=$(temp_path); cat "$path" >"$snapshot" || { rm -f "$snapshot"; return 2; }; consumer_canonical_regular "$path" >/dev/null && [ "$identity" = "$(consumer_source_identity "$path")" ] || { rm -f "$snapshot"; return 2; }; printf '%s|%s\n' "$snapshot" "$identity"; }
consumer_file_fingerprint() { path=$1; captured=$(consumer_snapshot "$path") || return 2; snapshot=${captured%%|*}; identity=${captured#*|}; printf '%s|%s|%s\n' "$path" "$(sha "$snapshot")" "$identity"; status=$?; rm -f "$snapshot"; return "$status"; }
consumer_matched_fingerprint() { path=$1; captured=$(consumer_snapshot "$path") || return 2; snapshot=${captured%%|*}; identity=${captured#*|}; if consumer_matches "$snapshot"; then matched=1; else status=$?; [ "$status" -eq 1 ] || { rm -f "$snapshot"; return "$status"; }; matched=0; fi; consumer_canonical_regular "$path" >/dev/null && [ "$identity" = "$(consumer_source_identity "$path")" ] || { rm -f "$snapshot"; return 2; }; [ "$matched" -eq 1 ] || { rm -f "$snapshot"; return 1; }; printf '%s|%s|%s\n' "$path" "$(sha "$snapshot")" "$identity"; status=$?; rm -f "$snapshot"; return "$status"; }
consumer_matches() { grep -q -Ei 'ollama|11434' "$1"; }
consumer_canonical_regular() { path=$1; [ -f "$path" ] && [ ! -L "$path" ] || return 2; real=$(readlink -f -- "$path") || return 2; [ "$real" = "$path" ] && [ -f "$real" ] && [ ! -L "$real" ] || return 2; printf '%s\n' "$real"; }
nginx_include_paths() { awk '
  function include(value) { if (value == "" || value ~ /[[:space:]]/ || value ~ /(^|\/)\.\.?(\/|$)/) bad=1; else print value }
  function token(value) { if (want == 1) { include(value); want=2; return }; if (start && value == "include") { want=1; return }; start=0 }
  BEGIN { start=1; quote=""; escaped=0; value=""; comment=0 }
  { line=$0 "\n"; for (i=1; i<=length(line); i++) { c=substr(line,i,1); if (comment) { if (c=="\n") comment=0; else continue }; if (quote!="") { if (escaped) { value=value c; escaped=0; continue }; if (c=="\\") { escaped=1; continue }; if (c==quote) { token(value); value=""; quote=""; continue }; value=value c; continue }; if (c=="#") { if (value!="") { token(value); value="" }; comment=1; continue }; if (c=="\047" || c=="\"") { if (value!="") { bad=1; value="" }; quote=c; continue }; if (c ~ /[[:space:]]/) { if (value!="") { token(value); value="" }; continue }; if (c==";" || c=="{" || c=="}") { if (value!="") { token(value); value="" }; if (want==2 && c==";") want=0; else if (want!=0) bad=1; if (c!=";") start=1; else start=1; continue }; value=value c } }
  END { if (value!="") token(value); if (quote!="" || escaped || want!=0) bad=1; exit bad?2:0 }
' "$1"; }
nginx_include_pattern() { pattern=$1; case "$pattern" in /*) printf '%s|%s\n' 0 "$pattern";; *) printf '%s|%s/%s\n' 1 "$NGINX_PREFIX" "$pattern";; esac; }
nginx_prefix_target() { case "$1" in "$NGINX_PREFIX"/*) return 0;; *) return 2;; esac; }
# shellcheck disable=SC2086 # Nginx includes require deliberate pathname expansion.
scan_nginx_file() {
  caller=$(consumer_canonical_regular "$1") || return 2; grep -Fqx "$caller" "$NGINX_SEEN" >/dev/null 2>&1 && return 0; printf '%s\n' "$caller" >>"$NGINX_SEEN" || return 2
  if record=$(consumer_matched_fingerprint "$caller"); then printf '%s\n' "$record"; else status=$?; [ "$status" -eq 1 ] || return "$status"; fi
  includes=$(temp_path); nginx_include_paths "$caller" >"$includes" || { status=$?; rm -f "$includes"; return "$status"; }
  while IFS= read -r include || [ -n "$include" ]; do bound=$(nginx_include_pattern "$include") || { rm -f "$includes"; return 2; }; relative=${bound%%|*}; pattern=${bound#*|}; case "$pattern" in *'*'*|*'?'*|*'['*) wildcard=1;; *) wildcard=0;; esac; set +f; set -- $pattern; set -f; [ -e "$1" ] || { [ "$wildcard" -eq 1 ] && continue; rm -f "$includes"; return 2; }; for candidate do target=$(consumer_canonical_regular "$candidate") || { rm -f "$includes"; return 2; }; [ "$relative" -eq 0 ] || nginx_prefix_target "$target" || { rm -f "$includes"; return 2; }; if target_record=$(consumer_matched_fingerprint "$target"); then definition_record=$(consumer_file_fingerprint "$caller") || { rm -f "$includes"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$includes"; return "$status"; }; fi; (scan_nginx_file "$target") || { status=$?; rm -f "$includes"; return "$status"; }; done; done <"$includes"; rm -f "$includes"
}
scan_nginx_definitions() { [ ! -e "$NGINX_ROOT" ] && return 0; [ -d "$NGINX_ROOT" ] && [ ! -L "$NGINX_ROOT" ] || return 2; NGINX_PREFIX=$(readlink -f -- "$NGINX_ROOT") || return 2; [ -d "$NGINX_PREFIX" ] && [ ! -L "$NGINX_PREFIX" ] || return 2; NGINX_SEEN=$(temp_path); list=$(temp_path); find "$NGINX_PREFIX" -type f >"$list" || { rm -f "$NGINX_SEEN" "$list"; return 2; }; while IFS= read -r path || [ -n "$path" ]; do scan_nginx_file "$path" || { status=$?; rm -f "$NGINX_SEEN" "$list"; return "$status"; }; done <"$list"; rm -f "$NGINX_SEEN" "$list"; }
compose_env_file_refs() {
  awk '
    function indent(s) { sub(/[^ ].*$/, "", s); return length(s) }
    function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
    function uncomment(s, out, i, c, prev, sq, dq, esc) {
      sq=0; dq=0; esc=0
      for (i=1; i<=length(s); i++) {
        c=substr(s, i, 1)
        if (esc) { out=out c; esc=0; prev=c; continue }
        if (c == "\\" && dq) { out=out c; esc=1; prev=c; continue }
        if (c == "\"" && !sq) { dq=!dq; out=out c; prev=c; continue }
        if (c == "\047" && !dq) { sq=!sq; out=out c; prev=c; continue }
        if (c == "#" && !sq && !dq && (i == 1 || prev ~ /[ \t]/)) return trim(out)
        out=out c; prev=c
      }
      return trim(out)
    }
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
    function flow_scalars(line, body, i, c, sq, dq, esc, item, count) {
      if (line !~ /^\[[[:space:]]*.*[[:space:]]*\]$/) return 0
      body=line; sub(/^\[[[:space:]]*/, "", body); sub(/[[:space:]]*\]$/, "", body); if (body == "") return 1
      sq=0; dq=0; esc=0; item=""; count=0
      for (i=1; i<=length(body); i++) { c=substr(body, i, 1); if (esc) { item=item c; esc=0; continue }; if (c == "\\" && dq) { item=item c; esc=1; continue }; if (c == "\"") { if (sq) item=item c; else { dq=!dq; item=item c }; continue }; if (c == "\047") { if (dq) item=item c; else { sq=!sq; item=item c }; continue }; if (!sq && !dq && c == ",") { item=trim(item); if (item == "") return 0; print "0:" item; count++; item=""; continue }; if (!sq && !dq && (c ~ /[\[\]\{\}]/ || c == ":")) return 0; item=item c }
      item=trim(item); if (esc || sq || dq || item == "") return 0; print "0:" item; return 1
    }
    {
      if ($0 ~ /^[[:space:]]*#/ || $0 ~ /^[[:space:]]*$/) next; n=indent($0)
      if ($0 ~ /^[[:space:]]*env_file:[[:space:]]*/) {
        line=$0; sub(/^[[:space:]]*env_file:[[:space:]]*/, "", line); line=uncomment(line); level=n
        if (line == "") { inside=1; mapped=0; path=""; required=""; format=""; next }
        if (line ~ /^\[/) { if (!flow_maps(line) && !flow_scalars(line)) bad=1; inside=0; next }
        if (line ~ /^\{/) { bad=1; next }; print "0:" line; inside=0; next
      }
      if (!inside) next
      if (n <= level) { if (mapped && !emit_map()) bad=1; inside=0; mapped=0; next }
      line=uncomment($0)
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
scan_compose_environment_files() { definition=$1; refs=$(temp_path); compose_env_file_refs "$definition" >"$refs" || { status=$?; rm -f "$refs"; return "$status"; }; while IFS=: read -r optional ref || [ -n "$optional$ref" ]; do case "$optional" in 0|1) :;; *) rm -f "$refs"; return 2;; esac; targets=$(temp_path); compose_env_file_path "$definition" "$optional" "$ref" >"$targets" || { rm -f "$refs" "$targets"; return 2; }; while IFS= read -r target || [ -n "$target" ]; do if target_record=$(consumer_matched_fingerprint "$target"); then definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$refs" "$targets"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$refs" "$targets"; return "$status"; }; fi; done <"$targets"; rm -f "$targets"; done <"$refs"; rm -f "$refs"; }
compose_build_refs() { awk '
  function indent(s) { sub(/[^ ].*$/, "", s); return length(s) }
  function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
  function uncomment(s, out, i, c, prev, sq, dq, esc) { sq=0; dq=0; esc=0; for (i=1; i<=length(s); i++) { c=substr(s,i,1); if (esc) { out=out c; esc=0; prev=c; continue }; if (c == "\\" && dq) { out=out c; esc=1; prev=c; continue }; if (c == "\"" && !sq) { dq=!dq; out=out c; prev=c; continue }; if (c == "\047" && !dq) { sq=!sq; out=out c; prev=c; continue }; if (c == "#" && !sq && !dq && (i == 1 || prev ~ /[ \\t]/)) return trim(out); out=out c; prev=c }; return trim(out) }
  function emit() { if (context == "") context="."; print context "\t" (dockerfile == "" ? "Dockerfile" : dockerfile); context=""; dockerfile=""; return 1 }
  function field(line, key, value) { key=line; sub(/[[:space:]]*:.*$/, "", key); value=line; sub(/^[^:]*:/, "", value); value=trim(value); if (value == "") return 0; if (key == "context") { if (context != "") return 0; context=value; return 1 }; if (key == "dockerfile") { if (dockerfile != "") return 0; dockerfile=value; return 1 }; return 0 }
  function flow(value, body, fields, count, i, item, key, scalar) {
    if (value !~ /^\{[[:space:]]*.*[[:space:]]*\}$/) return 0
    body=value; sub(/^\{[[:space:]]*/, "", body); sub(/[[:space:]]*\}$/, "", body)
    if (body == "") return 0
    count=split(body, fields, /,/)
    for (i=1; i<=count; i++) {
      item=trim(fields[i])
      if (item !~ /^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:/) return 0
      key=item; sub(/[[:space:]]*:.*$/, "", key)
      scalar=item; sub(/^[^:]*:/, "", scalar); scalar=trim(scalar)
      if (scalar == "" || scalar ~ /[\[\{\\]/) return 0
      if ((key == "context" || key == "dockerfile") && !field(item)) return 0
    }
    return emit()
  }
  {
    if ($0 ~ /^[[:space:]]*#/ || $0 ~ /^[[:space:]]*$/) next; n=indent($0); line=uncomment($0)
    if (inside && n <= level) { if (!emit()) bad=1; inside=0 }
    if (line ~ /^[[:space:]]*build:[[:space:]]*/) { value=line; sub(/^[[:space:]]*build:[[:space:]]*/, "", value); level=n; if (value == "") { inside=1; field_level=-1; context=""; dockerfile=""; next }; if (value ~ /^\{/) { context=""; dockerfile=""; if (!flow(value)) bad=1; next }; if (value ~ /^[\\\[]/) { bad=1; next }; print value "\tDockerfile"; next }
    if (inside) { if (n < field_level || (field_level == -1 && n <= level)) bad=1; else if (field_level == -1) field_level=n; if (n == field_level && line ~ /^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:/) { key=line; sub(/[[:space:]]*:.*$/, "", key); if ((key == "context" || key == "dockerfile") && !field(line)) bad=1 } }
  }
  END { if (inside && !emit()) bad=1; exit bad ? 2 : 0 }
' "$1"; }
compose_single_word() { value=$1; parsed=$(temp_path); parse_systemd_words "$value" >"$parsed" || { rm -f "$parsed"; return 2; }; [ "$(wc -l <"$parsed")" -eq 1 ] || { rm -f "$parsed"; return 2; }; IFS= read -r item <"$parsed" || { rm -f "$parsed"; return 2; }; rm -f "$parsed"; printf '%s\n' "$item"; }
compose_project_root() { [ -d "$1" ] && [ ! -L "$1" ] || return 2; root=$(readlink -f -- "$1") || return 2; [ -d "$root" ] && [ ! -L "$root" ] || return 2; printf '%s\n' "$root"; }
compose_project_path() { root=$1; base=$2; value=$3; allow_parent=$4; item=$(compose_single_word "$value") || return 2; case "$item" in ''|/*) return 2;; esac; path=$base; while [ -n "$item" ]; do part=${item%%/*}; if [ "$item" = "$part" ]; then item=''; else item=${item#*/}; fi; case "$part" in '') return 2;; .) :;; ..) [ "$allow_parent" -eq 1 ] || return 2; path=$(dirname "$path");; *) path=$path/$part; [ ! -L "$path" ] || return 2;; esac; case "$path" in "$root"|"$root"/*) :;; *) return 2;; esac; done; printf '%s\n' "$path"; }
compose_build_dockerfile() { definition=$1; root=$(compose_project_root "$2") || return 2; base=$(readlink -f -- "$(dirname "$definition")") || return 2; [ -d "$base" ] && [ ! -L "$base" ] || return 2; case "$base" in "$root"|"$root"/*) :;; *) return 2;; esac; context_path=$(compose_project_path "$root" "$base" "$3" 1) || return 2; [ -d "$context_path" ] && [ ! -L "$context_path" ] || return 2; target=$(compose_project_path "$root" "$context_path" "$4" 1) || return 2; consumer_canonical_regular "$target"; }
scan_compose_build_files() { definition=$1; root=$2; refs=$(temp_path); compose_build_refs "$definition" >"$refs" || { status=$?; rm -f "$refs"; return "$status"; }; tab=$(printf '\t'); while IFS="$tab" read -r context dockerfile || [ -n "$context$dockerfile" ]; do [ -n "$context" ] && [ -n "$dockerfile" ] || { rm -f "$refs"; return 2; }; target=$(compose_build_dockerfile "$definition" "$root" "$context" "$dockerfile") || { rm -f "$refs"; return 2; }; if target_record=$(consumer_matched_fingerprint "$target"); then definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$refs"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$refs"; return "$status"; }; fi; done <"$refs"; rm -f "$refs"; }
compose_extends_file_refs() { awk 'function indent(s){sub(/[^ ].*$/,"",s);return length(s)} function trim(s){sub(/^[[:space:]]*/,"",s);sub(/[[:space:]]*$/,"",s);return s} function value(s){sub(/^[^:]*:[[:space:]]*/,"",s);sub(/[[:space:]]+#.*$/,"",s);return trim(s)} function flow(v,fields,n,i,item,key,val,seen){if(v!~/^\{.*\}$/)return 0;sub(/^\{[[:space:]]*/,"",v);sub(/[[:space:]]*\}$/,"",v);n=split(v,fields,/,/);for(i=1;i<=n;i++){item=trim(fields[i]);if(item!~/^[A-Za-z_][A-Za-z0-9_]*[[:space:]]*:/)return 0;key=item;sub(/[[:space:]]*:.*$/,"",key);val=value(item);if(key=="file"){if(seen||val=="")return 0;file=val;seen=1}else if(key!="service"||val=="")return 0}if(!seen)return 0;print file;return 1} {n=indent($0);if($0~/^[[:space:]]*extends:[[:space:]]*/){v=value($0);if(v==""){inside=1;level=n;found=0}else{inside=0;if(!flow(v))bad=1}next}if(inside&&n<=level)inside=0;if(inside&&$0~/^[[:space:]]*file:[[:space:]]*/){v=value($0);if(v==""||found++)bad=1;else print v}} END{exit bad?2:0}' "$1"; }
compose_extends_path() { definition=$1; root=$2; base=$(readlink -f -- "$(dirname "$definition")") || return 2; target=$(compose_project_path "$root" "$base" "$3" 1) || return 2; consumer_canonical_regular "$target"; }
compose_external_file_refs() { awk '
  function indent(s) { sub(/[^ ].*$/, "", s); return length(s) }
  function trim(s) { sub(/^[[:space:]]+/, "", s); sub(/[[:space:]]+$/, "", s); return s }
  function value(s) { sub(/^[^:]*:[[:space:]]*/, "", s); sub(/[[:space:]]+#.*$/, "", s); return trim(s) }
  {
    n=indent($0)
    if (inside && n <= level) inside=0
    if ($0 ~ /^[[:space:]]*(configs|secrets):[[:space:]]*$/) { inside=1; level=n; kind=$0; sub(/^[[:space:]]*/, "", kind); sub(/:.*/, "", kind); next }
    if ($0 ~ /^[[:space:]]*(configs|secrets):[[:space:]]*[^[:space:]#]/) { bad=1; next }
    if (inside && $0 ~ /^[[:space:]]*file:[[:space:]]*/) { ref=value($0); if (ref == "") bad=1; else print kind "\t" ref }
  }
  END { exit bad ? 2 : 0 }
' "$1"; }
compose_external_file_path() { definition=$1; root=$2; base=$(readlink -f -- "$(dirname "$definition")") || return 2; [ -d "$base" ] && [ ! -L "$base" ] || return 2; case "$base" in "$root"|"$root"/*) :;; *) return 2;; esac; target=$(compose_project_path "$root" "$base" "$3" 1) || return 2; consumer_canonical_regular "$target"; }
scan_compose_external_files() { definition=$1; root=$2; refs=$(temp_path); compose_external_file_refs "$definition" >"$refs" || { status=$?; rm -f "$refs"; return "$status"; }; tab=$(printf '\t'); while IFS="$tab" read -r kind ref || [ -n "$kind$ref" ]; do case "$kind" in configs|secrets) :;; *) rm -f "$refs"; return 2;; esac; target=$(compose_external_file_path "$definition" "$root" "$ref") || { rm -f "$refs"; return 2; }; if target_record=$(consumer_matched_fingerprint "$target"); then definition_record=$(consumer_file_fingerprint "$definition") || { rm -f "$refs"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$refs"; return "$status"; }; fi; done <"$refs"; rm -f "$refs"; }
compose_uses_interpolation() { captured=$(consumer_snapshot "$1") || return 2; snapshot=${captured%%|*}; identity=${captured#*|}; awk 'function identifier(c){return c~/[A-Za-z_]/}{for(i=1;i<=length($0);i++){if(substr($0,i,1)!="$")continue;n=substr($0,i+1,1);if(n=="$"){i++;continue}if(identifier(n)){found=1;break}if(n=="{"&&identifier(substr($0,i+2,1))){found=1;break}}}END{exit found?0:1}' "$snapshot"; status=$?; consumer_canonical_regular "$1" >/dev/null && [ "$identity" = "$(consumer_source_identity "$1")" ] || status=2; rm -f "$snapshot"; return "$status"; }
scan_compose_project_environment() { source_definition=$1; project_source=$2; compose_uses_interpolation "$source_definition" || { status=$?; [ "$status" -eq 1 ] && return 0; return "$status"; }; targets=$(temp_path); compose_env_file_path "$project_source" 1 .env >"$targets" || { rm -f "$targets"; return 2; }; while IFS= read -r target || [ -n "$target" ]; do if target_record=$(consumer_matched_fingerprint "$target"); then definition_record=$(consumer_file_fingerprint "$source_definition") || { rm -f "$targets"; return 2; }; printf '%s|%s\n' "$definition_record" "$target_record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$targets"; return "$status"; }; fi; done <"$targets"; rm -f "$targets"; }
scan_compose_definition() { root=$1; path=$2; seen=$3; project_definition=$4; grep -Fqx -- "$path" "$seen" >/dev/null 2>&1 && return 0; printf '%s\n' "$path" >>"$seen" || return 2; if record=$(consumer_matched_fingerprint "$path"); then printf '%s\n' "$record"; else status=$?; [ "$status" -eq 1 ] || return "$status"; fi; case "$path" in *Containerfile) return 0;; esac; scan_compose_environment_files "$path" && scan_compose_project_environment "$path" "$project_definition" && scan_compose_build_files "$path" "$root" && scan_compose_external_files "$path" "$root" || return "$?"; refs=$(temp_path); compose_extends_file_refs "$path" >"$refs" || { status=$?; rm -f "$refs"; return "$status"; }; while IFS= read -r ref || [ -n "$ref" ]; do target=$(compose_extends_path "$path" "$root" "$ref") || { rm -f "$refs"; return 2; }; scan_compose_definition "$root" "$target" "$seen" "$project_definition" || { status=$?; rm -f "$refs"; return "$status"; }; done <"$refs"; rm -f "$refs"; }
scan_compose_definitions() { list=$(temp_path); seen=$(temp_path); tab=$(printf '\t'); for configured_root in $COMPOSE_ROOTS; do [ ! -e "$configured_root" ] && continue; root=$(compose_project_root "$configured_root") || { rm -f "$list" "$seen"; return 2; }; paths=$(temp_path); find "$root" -maxdepth 5 -type f \( -name 'docker-compose*.yml' -o -name 'docker-compose*.yaml' -o -name 'compose*.yml' -o -name 'compose*.yaml' -o -name 'Containerfile' \) >"$paths" || { rm -f "$list" "$seen" "$paths"; return 2; }; while IFS= read -r path || [ -n "$path" ]; do printf '%s\t%s\n' "$root" "$path" >>"$list" || { rm -f "$list" "$seen" "$paths"; return 2; }; done <"$paths"; rm -f "$paths"; done; while IFS="$tab" read -r root path || [ -n "$root$path" ]; do [ -n "$root" ] && [ -n "$path" ] && scan_compose_definition "$root" "$path" "$seen" "$path" || { status=$?; rm -f "$list" "$seen"; return "$status"; }; done <"$list"; rm -f "$list" "$seen"; }
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
systemd_system_roots() { output=$1; case ${SYSTEMD_ROOTS-} in ''|'/etc/systemd/system /lib/systemd/system') systemd_root_manifest "$output" /etc/systemd/system.control /run/systemd/system.control /run/systemd/transient /run/systemd/generator.early /etc/systemd/system /etc/systemd/system.attached /run/systemd/system /run/systemd/system.attached /run/systemd/generator /usr/local/lib/systemd/system /usr/lib/systemd/system /lib/systemd/system /run/systemd/generator.late;; *) systemd_root_manifest "$output" $SYSTEMD_ROOTS;; esac; }
systemd_reviewed_system_definition() { path=$1; roots=$2; case "$path" in */"$UNIT"|*/"$UNIT".d/*|*/"$TIMER"|*/"$TIMER".d/*) :;; *) return 1;; esac; while IFS= read -r root || [ -n "$root" ]; do case "$path" in "$root"/*) return 0;; esac; done <"$roots"; return 1; }
systemd_definition_in_roots() { path=$1; roots=$2; while IFS= read -r root || [ -n "$root" ]; do case "$path" in "$root"/*) return 0;; esac; done <"$roots"; return 2; }
systemd_environment_file_directives() { awk 'function emit(s){sub(/^[[:space:]]*/,"",s);if(s~/^EnvironmentFile=/)print s} {line=$0;if(joined!="")line=joined " " line;if(line~/\\$/){sub(/\\$/,"",line);joined=line;next}emit(line);joined=""} END{if(joined!="")exit 2}' "$1"; }
systemd_environment_file_inventory() { roots=$1; output=$2; files=$(temp_path); while IFS= read -r root || [ -n "$root" ]; do find "$root" -type f >>"$files" || { rm -f "$files"; return 2; }; done <"$roots"; while IFS= read -r definition || [ -n "$definition" ]; do directives=$(temp_path); systemd_environment_file_directives "$definition" >"$directives" || { rm -f "$files" "$directives"; return 2; }; while IFS= read -r directive || [ -n "$directive" ]; do printf '%s:%s\n' "$definition" "$directive" >>"$output" || { rm -f "$files" "$directives"; return 2; }; done <"$directives"; rm -f "$directives"; done <"$files"; rm -f "$files"; }
systemd_linked_definitions() {
  environment_files=$1; roots=$2; exclude_reviewed=$3; inventory=$(temp_path); seen=$(temp_path)
  while IFS= read -r root || [ -n "$root" ]; do find "$root" -type l \( -name '*.service' -o -name '*.socket' -o -name '*.timer' \) >>"$inventory" || { status=$?; rm -f "$inventory" "$seen"; return "$status"; }; done <"$roots"
  while IFS= read -r candidate || [ -n "$candidate" ]; do
    name=${candidate##*/}; case "$name" in ''|*[!A-Za-z0-9@_.-]*) rm -f "$inventory" "$seen"; return 2;; esac
    target=$(readlink -- "$candidate") || { rm -f "$inventory" "$seen"; return 2; }; case "$target" in /*) definition=$(consumer_canonical_regular "$target") || { rm -f "$inventory" "$seen"; return 2; };; *) resolved=$(readlink -f -- "$candidate") || { rm -f "$inventory" "$seen"; return 2; }; definition=$(consumer_canonical_regular "$resolved") || { rm -f "$inventory" "$seen"; return 2; }; systemd_definition_in_roots "$definition" "$roots" || { rm -f "$inventory" "$seen"; return 2; }; continue;; esac
    if grep -Fqx -- "$definition" "$seen" >/dev/null 2>&1; then continue; else status=$?; [ "$status" -eq 1 ] || { rm -f "$inventory" "$seen"; return "$status"; }; fi; printf '%s\n' "$definition" >>"$seen" || { rm -f "$inventory" "$seen"; return 2; }
    if [ "$exclude_reviewed" -eq 1 ] && systemd_reviewed_system_definition "$definition" "$roots"; then continue; fi
    if record=$(consumer_matched_fingerprint "$definition"); then printf '%s\n' "$record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$inventory" "$seen"; return "$status"; }; fi
    directives=$(temp_path); systemd_environment_file_directives "$definition" >"$directives" || { rm -f "$inventory" "$seen" "$directives"; return 2; }; while IFS= read -r directive || [ -n "$directive" ]; do printf '%s:%s\n' "$definition" "$directive" >>"$environment_files" || { rm -f "$inventory" "$seen" "$directives"; return 2; }; done <"$directives"; rm -f "$directives"
  done <"$inventory"
  rm -f "$inventory" "$seen"
}
systemd_environment_targets() { path=$1; optional=$2; case "$path" in *'*'*|*'?'*|*'['*) case "$path" in *[[:space:]]*) return 2;; esac; set +f; set -- $path; set -f;; *) set -- "$path";; esac; [ -e "$1" ] || { [ "$optional" -eq 1 ] && return 0; return 2; }; for candidate do consumer_canonical_regular "$candidate" || return 2; done; }
scan_systemd_runtime_environment_files() { name=$1; value=$2; parsed=$(temp_path); parse_systemd_words "$value" >"$parsed" || { rm -f "$parsed"; return 2; }; while IFS= read -r item || [ -n "$item" ]; do optional=0; case "$item" in -/*) optional=1; item=${item#-};; /*) :;; *) rm -f "$parsed"; return 2;; esac; IFS= read -r annotation || { rm -f "$parsed"; return 2; }; case "$annotation" in '(ignore_errors=no)') [ "$optional" -eq 0 ] || { rm -f "$parsed"; return 2; };; '(ignore_errors=yes)') optional=1;; *) rm -f "$parsed"; return 2;; esac; targets=$(temp_path); systemd_environment_targets "$item" "$optional" >"$targets" || { rm -f "$parsed" "$targets"; return 2; }; while IFS= read -r target || [ -n "$target" ]; do [ "${RECOVERY_RECORDS+x}" = x ] && recovery_record_environment "$target" "$optional"; if target_record=$(consumer_matched_fingerprint "$target"); then matched=1; else status=$?; [ "$status" -eq 1 ] || { rm -f "$parsed" "$targets"; return "$status"; }; matched=0; target_record=$(consumer_file_fingerprint "$target") || { rm -f "$parsed" "$targets"; return 2; }; fi; if [ "$matched" -eq 1 ] || printf '%s\n' "$value" | grep -q -Ei 'ollama|11434'; then printf '%s:%s|%s|%s|%s\n' "$name" "$target" "$(hash_text "EnvironmentFiles=$value")" "$(hash_text "$name")" "$target_record"; fi; done <"$targets"; rm -f "$targets"; done <"$parsed"; rm -f "$parsed"; }
scan_systemd_runtime_consumers() { manager=${1:-system}; units=$(temp_path); properties=$(temp_path); systemd_runtime_inventory "$manager" "$units" || { status=$?; rm -f "$units" "$properties"; return "$status"; }; while read -r name _ || [ -n "$name" ]; do case "$manager:$name" in system:|system:"$UNIT"|system:"$TIMER"|user:) continue;; esac; if systemd_manager_call "$manager" show --property=Environment --property=EnvironmentFiles --property=ExecCondition --property=ExecStartPre --property=ExecStart --property=ExecStartPost --property=ExecReload --property=ExecStop --property=ExecStopPost --no-pager -- "$name" >"$properties"; then :; else status=$?; refreshed=$(temp_path); systemd_runtime_inventory "$manager" "$refreshed" || { rm -f "$units" "$properties" "$refreshed"; return "$status"; }; if systemd_runtime_has_unit "$refreshed" "$name"; then rm -f "$units" "$properties" "$refreshed"; return "$status"; fi; rm -f "$refreshed"; continue; fi; while IFS= read -r property || [ -n "$property" ]; do case "$property" in EnvironmentFiles=*) scan_systemd_runtime_environment_files "$name" "${property#EnvironmentFiles=}" || { status=$?; rm -f "$units" "$properties"; return "$status"; };; *) if printf '%s\n' "$property" | grep -q -Ei 'ollama|11434'; then printf '%s:%s\n' "$name" "$(hash_text "$property")"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$units" "$properties"; return "$status"; }; fi;; esac; done <"$properties"; done <"$units"; rm -f "$units" "$properties"; }
scan_systemd_consumers() {
  list=$(temp_path); environment_files=$(temp_path); system_roots=$(temp_path); user_roots=$(temp_path); owner_context=''; user_runtime=0
  systemd_system_roots "$system_roots" || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  if owner_context=$(systemd_owner_context); then systemd_user_roots "$owner_context" >"$user_roots" || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  while IFS= read -r root || [ -n "$root" ]; do
    if grep -r -l -Ei 'ollama|11434' "$root" >>"$list"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  done <"$system_roots"
  while IFS= read -r root || [ -n "$root" ]; do
    if grep -r -l -Ei 'ollama|11434' "$root" >>"$list"; then :; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  done <"$user_roots"
  systemd_environment_file_inventory "$system_roots" "$environment_files" && systemd_environment_file_inventory "$user_roots" "$environment_files" || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  systemd_linked_definitions "$environment_files" "$system_roots" 1 || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  systemd_linked_definitions "$environment_files" "$user_roots" 0 || { status=$?; rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }
  if [ -n "$owner_context" ] && systemd_user_manager_available "$owner_context"; then user_runtime=1; else status=$?; [ -z "$owner_context" ] || [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files" "$system_roots" "$user_roots"; return "$status"; }; fi
  rm -f "$user_roots"
  while IFS= read -r path || [ -n "$path" ]; do if systemd_reviewed_system_definition "$path" "$system_roots"; then :; elif record=$(consumer_matched_fingerprint "$path"); then printf '%s\n' "$record"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$list" "$environment_files"; return "$status"; }; fi; done <"$list"
  rm -f "$list"
  while IFS=: read -r definition directive || [ -n "$definition$directive" ]; do
    systemd_reviewed_system_definition "$definition" "$system_roots" && continue
    value=${directive#*=}; parsed=$(temp_path); parse_systemd_words "$value" >"$parsed" || { status=$?; rm -f "$parsed"; return "$status"; }
    while IFS= read -r item || [ -n "$item" ]; do
      optional=0; case "$item" in -*) optional=1; item=${item#-};; esac
      case "$item" in /*) :;; *) rm -f "$parsed"; return 2;; esac
      targets=$(temp_path); systemd_environment_targets "$item" "$optional" >"$targets" || { rm -f "$parsed" "$targets"; return 2; }
      while IFS= read -r target || [ -n "$target" ]; do
        [ "${RECOVERY_RECORDS+x}" = x ] && recovery_record_environment "$target" "$optional"
        if item_record=$(consumer_matched_fingerprint "$target"); then
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
  rm -f "$environment_files" "$system_roots"
  scan_systemd_runtime_consumers system || return "$?"
  [ "$user_runtime" -eq 0 ] && return 0
  scan_systemd_runtime_consumers user
}
# shellcheck disable=SC2094 # Snapshot names remain open only for read-before-cleanup.
container_volume_metadata() { name=$1; source=$2; raw=$(temp_path); docker --host "unix://$CANONICAL_DOCKER_SOCKET" volume inspect -f '{{json .}}' "$name" >"$raw" || { status=$?; rm -f "$raw"; return "$status"; }; value=$(/usr/bin/jq -er --arg name "$name" --arg source "$source" 'if type != "object" or .Name != $name or .Driver != "local" or .Mountpoint != $source or .Scope != "local" then error("invalid volume") else [.Name,.Driver,.Mountpoint,.Scope] | @tsv end' "$raw") || { rm -f "$raw"; return 2; }; rm -f "$raw"; hash_text "$value"; }
container_volume_files() { root=$1; [ -d "$root" ] && [ ! -L "$root" ] || return 2; real=$(readlink -f -- "$root") || return 2; [ "$real" = "$root" ] && [ -d "$real" ] && [ ! -L "$real" ] || return 2; device=$(stat -c '%d' "$root") || return 2; paths=$(temp_path); files=$(temp_path); find "$root" -xdev -print >"$paths" || { rm -f "$paths" "$files"; return 2; }; while IFS= read -r path || [ -n "$path" ]; do [ -n "$path" ] && [ ! -L "$path" ] || { rm -f "$paths" "$files"; return 2; }; canonical=$(readlink -f -- "$path") || { rm -f "$paths" "$files"; return 2; }; [ "$canonical" = "$path" ] && [ "$(stat -c '%d' "$path")" = "$device" ] || { rm -f "$paths" "$files"; return 2; }; case "$(stat -c '%F' "$path")" in directory) :;; 'regular file') printf '%s\n' "$path" >>"$files" || { rm -f "$paths" "$files"; return 2; };; *) rm -f "$paths" "$files"; return 2;; esac; done <"$paths"; sort -u "$files"; status=$?; rm -f "$paths" "$files"; return "$status"; }
container_volume_consumers() { id=$1; name=$2; source=$3; destination=$4; metadata=$(container_volume_metadata "$name" "$source") || return "$?"; paths=$(temp_path); first=$(temp_path); (container_volume_files "$source") >"$paths" || { rm -f "$paths" "$first"; return 2; }; while IFS= read -r path || [ -n "$path" ]; do consumer_file_fingerprint "$path" >>"$first" || { rm -f "$paths" "$first"; return 2; }; done <"$paths"; while IFS='|' read -r path content identity || [ -n "$path$content$identity" ]; do record=$(consumer_matched_fingerprint "$path"); status=$?; if [ "$status" -eq 0 ]; then [ "$record" = "$path|$content|$identity" ] || { rm -f "$paths" "$first"; return 2; }; printf 'container-volume:%s|%s|%s|%s|%s\n' "$(hash_text "$id")" "$(hash_text "$destination")" "$(hash_text "$name")" "$content" "$identity"; elif [ "$status" -ne 1 ]; then rm -f "$paths" "$first"; return "$status"; fi; done <"$first"; after=$(temp_path); (container_volume_files "$source") >"$paths" || { rm -f "$paths" "$first" "$after"; return 2; }; while IFS= read -r path || [ -n "$path" ]; do consumer_file_fingerprint "$path" >>"$after" || { rm -f "$paths" "$first" "$after"; return 2; }; done <"$paths"; cmp -s "$first" "$after" && [ "$metadata" = "$(container_volume_metadata "$name" "$source")" ] || { rm -f "$paths" "$first" "$after"; return 2; }; rm -f "$paths" "$first" "$after"; }
container_bind_mount_consumers() {
  id=$1; mounts=$(temp_path); docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .Mounts}}' "$id" >"$mounts" || { status=$?; rm -f "$mounts"; return "$status"; }
  paths=$(temp_path); /usr/bin/jq -r 'def bind_path: type == "string" and startswith("/") and (test("[\\t\\r\\n]") | not); def volume_path: bind_path and test("^/[A-Za-z0-9._/-]+$") and (test("(^|/)\\.\\.?(/|$)") | not); if type != "array" or any(.[]; type != "object" or (.Type | type) != "string") then error("invalid mounts") else .[] | if .Type == "bind" then if (.Source | bind_path) and (.Destination | bind_path) then ["bind",.Source,.Destination] | @tsv else error("invalid bind mount") end elif .Type == "volume" then if (.Name | type) != "string" or (.Name | test("^[A-Za-z0-9][A-Za-z0-9_.-]*$") | not) or (.Source | volume_path | not) or (.Destination | volume_path | not) or .Driver != "local" or (.Mode | type) != "string" or (.RW | type) != "boolean" or (.Propagation | type) != "string" then error("invalid volume mount") else ["volume",.Name,.Source,.Destination,.Driver] | @tsv end elif .Type == "tmpfs" then if .Source != "" or (.Destination | bind_path | not) or (.Mode | type) != "string" or (.RW | type) != "boolean" or (.Propagation | type) != "string" or (.Name != null and .Name != "") then error("invalid tmpfs mount") else ["tmpfs",.Destination] | @tsv end else error("unsupported mount") end end' "$mounts" >"$paths" || { rm -f "$mounts" "$paths"; return 2; }; rm -f "$mounts"
  tab=$(printf '\t')
  while IFS="$tab" read -r type first source destination driver || [ -n "$type$first$source$destination$driver" ]; do
    case "$type" in bind) [ -n "$first" ] && [ -n "$source" ] && [ -z "$destination$driver" ] || { rm -f "$paths"; return 2; }; [ -f "$first" ] && [ ! -L "$first" ] || { rm -f "$paths"; return 2; }; real=$(readlink -f -- "$first") || { rm -f "$paths"; return 2; }; [ "$real" = "$first" ] || { rm -f "$paths"; return 2; }; if fingerprint=$(consumer_matched_fingerprint "$first"); then printf 'container-bind-mount:%s:%s|%s\n' "$id" "$source" "$fingerprint"; else status=$?; [ "$status" -eq 1 ] || { rm -f "$paths"; return "$status"; }; fi;; volume) [ -n "$first$source$destination$driver" ] && [ "$driver" = local ] || { rm -f "$paths"; return 2; }; container_volume_consumers "$id" "$first" "$source" "$destination" || { status=$?; rm -f "$paths"; return "$status"; };; tmpfs) [ -n "$first" ] && [ -z "$source$destination$driver" ] || { rm -f "$paths"; return 2; };; *) rm -f "$paths"; return 2;; esac
  done <"$paths"; rm -f "$paths"
}
# shellcheck disable=SC2094 # The open inventory snapshot remains readable after error cleanup unlinks it.
container_inventory() { scope=$1; output=$2; if [ "$scope" = all ]; then docker --host "unix://$CANONICAL_DOCKER_SOCKET" ps -a --no-trunc --format '{{.ID}}' >"$output"; else docker --host "unix://$CANONICAL_DOCKER_SOCKET" ps --no-trunc --format '{{.ID}}' >"$output"; fi; }
scan_container_snapshot() {
  scope=$1; raw=$2
  while IFS= read -r id || [ -n "$id" ]; do [ -n "$id" ] || continue; attempt=0; while :; do
    if name=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{.Name}}' "$id"); then
      if [ "$name" = "/$CONTAINER" ]; then bound=''; status=0
      elif line=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{.Id}} {{.Name}} {{.Path}} {{json .Args}} {{json .Config.Env}} {{json .Config.Healthcheck}} {{json .Mounts}} {{json .HostConfig.PortBindings}} {{json .NetworkSettings.Ports}} {{json .NetworkSettings.Networks}}' "$id"); then
        if bound=$(container_bind_mount_consumers "$id"); then printf '%s' "$line" | /usr/bin/grep -Eqi 'ollama|11434' && printf '%s\n' "$line"; status=0; else status=$?; fi
      else status=$?
      fi
      if [ "$status" -eq 0 ]; then [ -z "$bound" ] || printf '%s\n' "$bound"; break; fi
    else status=$?; fi
    [ "$attempt" -eq 0 ] || { fresh=$(temp_path); container_inventory "$scope" "$fresh" || { rm -f "$fresh"; return "$status"; }; if grep -Fqx -- "$id" "$fresh"; then rm -f "$fresh"; return "$status"; fi; rm -f "$fresh"; break; }; attempt=$((attempt + 1))
  done; done <"$raw"
}
scan_container_rows() {
  scope=$1; attempts=0
  while :; do
    raw=$(temp_path); first=$(temp_path); records=$(temp_path)
    container_inventory "$scope" "$raw" || { status=$?; rm -f "$raw" "$first" "$records"; return "$status"; }
    sort -u "$raw" >"$first" || { rm -f "$raw" "$first" "$records"; return 2; }; rm -f "$raw"
    scan_container_snapshot "$scope" "$first" >"$records" || { status=$?; rm -f "$first" "$records"; return "$status"; }
    fresh=$(temp_path); latest=$(temp_path); container_inventory "$scope" "$fresh" || { status=$?; rm -f "$first" "$records" "$fresh" "$latest"; return "$status"; }
    sort -u "$fresh" >"$latest" || { rm -f "$first" "$records" "$fresh" "$latest"; return 2; }; rm -f "$fresh"
    if cmp -s "$first" "$latest"; then cat "$records"; status=$?; rm -f "$first" "$records" "$latest"; return "$status"; fi
    rm -f "$first" "$records" "$latest"
    attempts=$((attempts + 1)); [ "$attempts" -lt "$CONTAINER_STABILITY_ATTEMPTS" ] || return 2
  done
}
