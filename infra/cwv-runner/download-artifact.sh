#!/bin/sh
set -eu
export LC_ALL=C

if [ "$#" -ne 6 ]; then
  printf '%s\n' 'usage: download-artifact.sh url sha256 allowed-origins-json destination max-bytes allowed-content-types-json' >&2
  exit 64
fi

url=$1
expected_sha=$2
allowed_origins=$3
destination=$4
max_bytes=$5
allowed_content_types=$6
curl_command=/usr/bin/curl
resolver_command=/usr/bin/getent
[ -x "$curl_command" ] && [ -x "$resolver_command" ]

origin_of() {
  case "$1" in
    https://*) authority=${1#https://} ;;
    *) return 1 ;;
  esac
  authority=${authority%%/*}
  authority=${authority%%\?*}
  authority=${authority%%\#*}
  [ -n "$authority" ] && ! printf '%s' "$authority" | grep -q '@'
  printf 'https://%s' "$(printf '%s' "$authority" | tr '[:upper:]' '[:lower:]')"
}

hostname_of() {
  authority=${1#https://}
  authority=${authority%%/*}
  authority=${authority%%\?*}
  authority=${authority%%\#*}
  case "$authority" in *:*|'') return 1 ;; esac
  printf '%s' "$authority" | tr '[:upper:]' '[:lower:]'
}

public_ipv4() {
  IFS=. read -r a b c d extra <<EOF
$1
EOF
  [ -n "$a" ] && [ -n "$b" ] && [ -n "$c" ] && [ -n "$d" ] && [ -z "$extra" ] || return 1
  for octet in "$a" "$b" "$c" "$d"; do
    case "$octet" in ''|*[!0-9]*) return 1 ;; esac
    [ "$octet" -le 255 ] || return 1
  done
  [ "$a" -ne 0 ] && [ "$a" -ne 10 ] && [ "$a" -ne 127 ] && [ "$a" -lt 224 ] || return 1
  ! { [ "$a" -eq 100 ] && [ "$b" -ge 64 ] && [ "$b" -le 127 ]; } || return 1
  ! { [ "$a" -eq 169 ] && [ "$b" -eq 254 ]; } || return 1
  ! { [ "$a" -eq 172 ] && [ "$b" -ge 16 ] && [ "$b" -le 31 ]; } || return 1
  ! { [ "$a" -eq 192 ] && { [ "$b" -eq 0 ] || [ "$b" -eq 168 ]; }; } || return 1
  ! { [ "$a" -eq 198 ] && { [ "$b" -eq 18 ] || [ "$b" -eq 19 ] || { [ "$b" -eq 51 ] && [ "$c" -eq 100 ]; }; }; } || return 1
  ! { [ "$a" -eq 203 ] && [ "$b" -eq 0 ] && [ "$c" -eq 113 ]; }
}

resolve_once() {
  /usr/bin/timeout --preserve-status "$2" "$resolver_command" ahostsv4 "$1" >"$answers"
  /usr/bin/awk '$2 == "STREAM" && !seen[$1]++ { values[++count] = $1 }
    END { if (count < 1 || count > 16) exit 1; for(i=1;i<=count;i++) for(j=i+1;j<=count;j++) if(values[j]<values[i]) { value=values[i]; values[i]=values[j]; values[j]=value } for(i=1;i<=count;i++) print values[i] }' "$answers"
}

allowed() {
  printf '%s' "$allowed_origins" | jq -e --arg origin "$1" \
    'type == "array" and length > 0 and all(.[]; type == "string") and index($origin) != null' \
    >/dev/null
}

allowed_content_type() {
  printf '%s' "$allowed_content_types" | jq -e --arg content_type "$1" \
    'type == "array" and length > 0 and all(.[]; type == "string" and test("^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$")) and length == (unique | length) and index($content_type) != null' \
    >/dev/null
}

response_content_type() {
  /usr/bin/awk '
    /^[Cc][Oo][Nn][Tt][Ee][Nn][Tt]-[Tt][Yy][Pp][Ee]:[[:space:]]*/ {
      count += 1
      value = $0
      sub(/^[^:]*:[[:space:]]*/, "", value)
      sub(/\r$/, "", value)
    }
    END { if (count != 1) exit 1; print value }
  ' "$headers"
}

printf '%s' "$expected_sha" | grep -Eq '^[0-9a-f]{64}$'
case "$max_bytes" in ''|*[!0-9]*) exit 1 ;; esac
[ "$max_bytes" -gt 0 ] && [ "$max_bytes" -le 2147483647 ]
normalized_content_types=$(printf '%s' "$allowed_content_types" | jq -ce \
  'type == "array" and length > 0 and all(.[]; type == "string" and test("^[a-z0-9!#$&^_.+-]+/[a-z0-9!#$&^_.+-]+$")) and length == (unique | length)' \
  >/dev/null && printf '%s' "$allowed_content_types")
[ "$normalized_content_types" = "$allowed_content_types" ]
initial_origin=$(origin_of "$url")
allowed "$initial_origin"
[ ! -e "$destination" ] && [ ! -L "$destination" ]
parent=$(dirname "$destination")
[ -d "$parent" ] && [ ! -L "$parent" ]
partial=$(mktemp "$parent/.artifact.XXXXXX")
headers=$(mktemp "$parent/.headers.XXXXXX")
answers=$(mktemp "$parent/.answers.XXXXXX")
trap 'rm -f "$partial" "$headers" "$answers"' EXIT HUP INT TERM

deadline_seconds=120
monotonic_milliseconds() {
  if [ -r /proc/uptime ]; then awk '{ printf "%.0f\n", $1 * 1000 }' /proc/uptime
  else date +%s000
  fi
}
remaining_timeout() {
  elapsed=$(( $(monotonic_milliseconds) - started ))
  remaining=$(( deadline_seconds * 1000 - elapsed ))
  [ "$remaining" -gt 0 ]
  printf '%d.%03d' "$(( remaining / 1000 ))" "$(( remaining % 1000 ))"
}
resolve_redirect() {
  current=$1
  location=$2
  [ -n "$location" ] && ! printf '%s' "$location" | grep -q '[[:cntrl:]]'
  case "$location" in
    https://*|http://*) printf '%s' "$location" ;;
    //*) printf 'https:%s' "$location" ;;
    /*) printf '%s%s' "$(origin_of "$current")" "$location" ;;
    \?*) printf '%s%s' "${current%%\?*}" "$location" ;;
    \#*) printf '%s%s' "${current%%\#*}" "$location" ;;
    ./*|../*|*/../*|*/./*) return 1 ;;
    *)
      base=${current%%\?*}; base=${base%%\#*}; origin=$(origin_of "$current")
      if [ "$base" = "$origin" ]; then printf '%s/%s' "$origin" "$location"
      else printf '%s/%s' "${base%/*}" "$location"
      fi
      ;;
  esac
}

started=$(monotonic_milliseconds)
current_url=$url
visited=
redirects=0
while :; do
  printf '%s' "$current_url" | grep -Eq '^https://[^/[:space:]@]+(/[^[:space:]]*)?$'
  current_origin=$(origin_of "$current_url")
  current_host=$(hostname_of "$current_url")
  allowed "$current_origin"
  if printf '%s\n' "$visited" | grep -Fqx "$current_url"; then exit 1; fi
  visited=$(printf '%s\n%s' "$visited" "$current_url")
  remaining=$(remaining_timeout)
  answer_set=$(resolve_once "$current_host" "$remaining")
  remaining=$(remaining_timeout)
  selected_ip=
  while IFS= read -r answer; do
    public_ipv4 "$answer"
    [ -n "$selected_ip" ] || selected_ip=$answer
  done <<EOF
$answer_set
EOF
  [ -n "$selected_ip" ]
  : >"$partial"
  : >"$headers"
  # Signed Ubuntu Noble curl is >=8.4; --max-filesize aborts unknown-length transfers at the threshold.
  if ! metadata=$(
    "$curl_command" --fail --silent --proto '=https' --proto-redir '=https' \
      --noproxy '*' --proxy '' \
      --resolve "$current_host:443:$selected_ip" \
      --connect-timeout 10 --speed-limit 1 --speed-time 30 --max-time "$remaining" --max-filesize "$max_bytes" \
      --dump-header "$headers" --output "$partial" \
      --write-out '%{http_code}\n%{url_effective}\n%{remote_ip}' "$current_url" 2>/dev/null
  ); then
    printf '%s\n' 'artifact download failed' >&2
    exit 1
  fi
  status=$(printf '%s\n' "$metadata" | sed -n '1p')
  effective_url=$(printf '%s\n' "$metadata" | sed -n '2p')
  remote_ip=$(printf '%s\n' "$metadata" | sed -n '3p')
  [ "$effective_url" = "$current_url" ]
  [ "$remote_ip" = "$selected_ip" ]
  case "$status" in
    200) break ;;
    301|302|303|307|308)
      [ "$redirects" -lt 5 ]
      location_count=$(awk 'tolower($1) == "location:" { count += 1 } END { print count + 0 }' "$headers")
      [ "$location_count" -eq 1 ]
      location=$(awk 'tolower($1) == "location:" { sub(/^[^:]*:[[:space:]]*/, ""); sub(/\r$/, ""); print }' "$headers")
      next_url=$(resolve_redirect "$current_url" "$location")
      next_origin=$(origin_of "$next_url")
      allowed "$next_origin"
      if printf '%s\n' "$visited" | grep -Fqx "$next_url"; then exit 1; fi
      current_url=$next_url
      redirects=$(( redirects + 1 ))
      ;;
    *) exit 1 ;;
  esac
done
content_type=$(response_content_type)
media_type=$(printf '%s' "$content_type" | /usr/bin/awk '{ sub(/^[[:space:]]+/, ""); sub(/[[:space:]]*;.*/, ""); sub(/[[:space:]]+$/, ""); print tolower($0) }')
allowed_content_type "$media_type"
[ "$(wc -c <"$partial")" -le "$max_bytes" ]
[ "$(sha256sum "$partial" | awk '{print $1}')" = "$expected_sha" ]
chmod 0444 "$partial"
mv "$partial" "$destination"
rm -f "$headers"
rm -f "$answers"
trap - EXIT HUP INT TERM
