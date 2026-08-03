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

systemd_quoted_command_path() {
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
      ;;
  esac
  rm -f "$words"
  case "$command" in
    /*) consumer_canonical_regular "$command" >/dev/null 2>&1 || return 1; printf '%s\n' "$command";;
    *) return 2;;
  esac
}

systemd_credential_file_directives() {
  awk 'function emit(s){sub(/^[[:space:]]*/,"",s);if(s~/^LoadCredential=/)print s}
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
    targets=$(temp_path); systemd_credential_targets "${directive#*=}" >"$targets" || { rm -f "$directives" "$targets"; return 2; }
    while IFS= read -r target || [ -n "$target" ]; do
      if target_record=$(consumer_matched_fingerprint "$target"); then
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
