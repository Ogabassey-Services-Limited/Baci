#!/bin/sh
RECOVERY_PROC_ROOT=${RETIRE_OLLAMA_PROC_ROOT:-/proc}
RECOVERY_CONTAINER_COMMAND_PATH=${RECOVERY_CONTAINER_COMMAND_PATH:-}
RECOVERY_CONTAINER_PORTS_FILE=${RECOVERY_CONTAINER_PORTS_FILE:-}
RECOVERY_SOURCE_SHA=${SCRIPT_DIR##*/}; RECOVERY_SOURCE_ROOT=/srv/baci-cwv/source; RECOVERY_RECEIPT_ROOT=/srv/baci-cwv/retired-ollama/recovery-scan; : "${RECOVERY_RECEIPT_ROOT}"
RECOVERY_RECEIPTS_HELPER="$SCRIPT_DIR/retire-ollama-recovery-receipts.sh"
[ -f "$RECOVERY_RECEIPTS_HELPER" ] && [ ! -L "$RECOVERY_RECEIPTS_HELPER" ] || review_required 'recovery receipts helper missing'
# shellcheck disable=SC1090,SC1091 # Resolved beside this sealed recovery helper.
. "$RECOVERY_RECEIPTS_HELPER"
recovery_dpkg_query() { dpkg-query "$@"; }
recovery_systemctl() { systemctl "$@"; }
recovery_docker() { docker --host "unix://$CANONICAL_DOCKER_SOCKET" "$@"; }
recovery_ps() { ps -eo pid=,ppid=,args=; }
recovery_safe_int() { case "$1" in ''|*[!0-9]*) return 1;; esac; [ "$1" -gt 0 ] 2>/dev/null; }; recovery_nonnegative_int() { case "$1" in ''|*[!0-9]*) return 1;; esac; [ "$1" -ge 0 ] 2>/dev/null; }
recovery_source_identity() { /usr/bin/printf '%s' "$1" | /usr/bin/grep -Eq '^[0-9a-f]{40}$' || return 1; [ "$(id -u)" -ne 0 ] || [ "$SCRIPT_DIR" = "$RECOVERY_SOURCE_ROOT/$1" ]; }
recovery_package_snapshot() {
  if package=$(recovery_dpkg_query -W "-f=\${db:Status-Abbrev} \${Version}" ollama 2>/dev/null); then
    status=${package%%  *}; version=${package#*  }
    case "$status" in [a-z][a-z]) :;; *) die 'invalid Ollama package status';; esac
    case "$version" in ''|*[[:space:]]*) die 'invalid Ollama package version';; esac
    case "$status" in ?i) :;; *) /usr/bin/jq -cn '{name:"ollama",state:"absent",version:null}'; return;; esac
    [ -n "$version" ] || die 'empty Ollama package version'; /usr/bin/jq -cn --arg version "$version" '{name:"ollama",state:"present",version:$version}'
  else
    status=$?; [ "$status" -eq 1 ] || die "Ollama package query failed ($status)"
    /usr/bin/jq -cn '{name:"ollama",state:"absent",version:null}'
  fi
}
recovery_unit_snapshot() { name=$1
  if value=$(recovery_systemctl show "$name" -p LoadState -p UnitFileState -p ActiveState 2>/dev/null); then
    properties=$(temp_path); printf '%s\n' "$value" >"$properties" || die 'unit state serialization failed'; load_state=; unit_file_state=; active_state=; load_seen=0; unit_seen=0; active_seen=0
    while IFS='=' read -r key property || [ -n "$key$property" ]; do case "$key" in LoadState) [ "$load_seen" -eq 0 ] || die 'duplicate LoadState'; load_state=$property; load_seen=1;; UnitFileState) [ "$unit_seen" -eq 0 ] || die 'duplicate UnitFileState'; unit_file_state=$property; unit_seen=1;; ActiveState) [ "$active_seen" -eq 0 ] || die 'duplicate ActiveState'; active_state=$property; active_seen=1;; *) /bin/rm -f -- "$properties"; die 'unknown unit state property';; esac; done <"$properties"
    /bin/rm -f -- "$properties"; [ "$load_seen" -eq 1 ] && [ "$unit_seen" -eq 1 ] && [ "$active_seen" -eq 1 ] || die 'incomplete unit state'
    case "$load_state" in not-found) /usr/bin/jq -cn --arg name "$name" '{name:$name,state:"absent"}';; '') die 'empty unit LoadState';; *) /usr/bin/jq -cn --arg name "$name" --arg load "$load_state" --arg unit "$unit_file_state" --arg active "$active_state" --arg value "$(hash_text "$value")" '{name:$name,state:"present",loadState:$load,unitFileState:$unit,activeState:$active,stateSha256:$value}';; esac
  else status=$?; [ "$status" -eq 4 ] || die "unit state failed $name ($status)"; /usr/bin/jq -cn --arg name "$name" '{name:$name,state:"absent"}'; fi; }
recovery_systemd_properties() { name=$1; property=$2; out=$3; if recovery_systemctl show "$name" -p "$property" --value >"$out" 2>/dev/null; then return 0; else status=$?; fi; case "$status" in 1|4) : >"$out"; return "$status";; *) die "systemd property failed $name ($status)";; esac; }
recovery_surface() {
  class=$1; shift; out=$(temp_path); err=$(temp_path)
  status=0; "$@" >"$out" 2>"$err" || status=$?
  case "$class:$status" in
    *:0|systemd-definitions:1|systemd-definitions:4|systemd-timer-definitions:1|systemd-timer-definitions:4) :;;
    *) /bin/rm -f -- "$out" "$err"; die "recovery surface failed $class ($status)";;
  esac
  value=$(sha "$out"); error=$(sha "$err")
  RECOVERY_RECORDS=$(/usr/bin/jq -cn --argjson old "$RECOVERY_RECORDS" --arg class "$class" --argjson status "$status" --arg value "$value" --arg error "$error" '$old + [{class:$class,exitStatus:$status,sha256:$value,stderrSha256:$error}]') || die "recovery surface serialization failed $class"
  case "$class" in
    systemd-consumers|reverse-proxy|compose-definitions|running-containers|container-definitions) record_consumers "$class" "$out" all || die "recovery consumer evidence failed $class";;
    current-crontab|running-processes) mode=matched; [ "$class" = current-crontab ] && mode=cron; record_consumers "$class" "$out" "$mode" || die "recovery consumer evidence failed $class";;
  esac
  /bin/rm -f -- "$out" "$err"
}
recovery_record_path() {
  class=$1; path=$2; optional=${3:-0}; case "$path" in /*) :;; *) die 'non-absolute recovery reference';; esac
  [ ! -L "$path" ] || die 'symlinked recovery reference'
  if [ -e "$path" ]; then
    real=$(readlink -f -- "$path") || die 'recovery reference resolution failed'; [ "$real" = "$path" ] || die 'replaced recovery reference'
    raw=$(temp_path); { stat -c '%d:%i:%f:%s:%u:%g:%a' "$path"; findmnt -no TARGET,SOURCE,FSTYPE,OPTIONS --target "$path"; } >"$raw" || { /bin/rm -f -- "$raw"; die 'recovery reference identity failed'; }
    identity=$(sha "$raw"); /bin/rm -f -- "$raw"; case "$(stat -c '%F' "$path")" in 'regular file') content=$(sha "$path");; *) content=$identity;; esac
    RECOVERY_RECORDS=$(/usr/bin/jq -cn --argjson old "$RECOVERY_RECORDS" --arg class "$class" --arg path "$real" --arg identity "$identity" --arg content "$content" '$old + [{class:$class,state:"present",realPath:$path,identitySha256:$identity,contentSha256:$content}]') || die 'recovery reference serialization failed'
  else
    [ "$optional" -eq 1 ] || die 'required recovery reference missing'
    path_sha=$(hash_text "$path"); RECOVERY_RECORDS=$(/usr/bin/jq -cn --argjson old "$RECOVERY_RECORDS" --arg class "$class" --arg path "$path_sha" '$old + [{class:$class,state:"absent",pathSha256:$path}]') || die 'recovery absent reference serialization failed'
  fi
}
recovery_environment_complete() { /usr/bin/printf '%s\n' "$1" | awk 'BEGIN{sq=0;dq=0;esc=0} {for(i=1;i<=length($0);i++){c=substr($0,i,1);if(esc){esc=0;continue};if(c=="\\"){esc=1;continue};if(c=="\""&&!sq)dq=!dq;else if(c=="\047"&&!dq)sq=!sq}} END{exit(sq||dq)}'; }
recovery_environment_continues() { /usr/bin/printf '%s\n' "$1" | awk '{n=0;for(i=length($0);i>0&&substr($0,i,1)=="\\";i--)n++;exit(n%2?0:1)}'; }
recovery_record_environment() {
  path=$1; optional=$2; recovery_record_path environment-file "$path" "$optional"; [ -f "$path" ] && [ ! -L "$path" ] || [ "$optional" -eq 1 ] || die 'required recovery environment file missing'; [ -f "$path" ] || return 0; pending=''
  while IFS= read -r line || [ -n "$line" ]; do [ -n "$pending" ] || { case "$line" in *[![:space:]]*) line=${line#"${line%%[![:space:]]*}"};; *) continue;; esac; case "$line" in '#'*|';'*) continue;; esac; }; pending=$pending$line; recovery_environment_continues "$line" && { pending=${pending%\\}; continue; }; recovery_environment_complete "$pending" && { case "$pending" in *=*) key=${pending%%=*}; value=${pending#*=};; *) die 'malformed recovery EnvironmentFile';; esac; case "$key" in ''|*[!A-Za-z_0-9]*|[0-9]*) die 'malformed recovery EnvironmentFile';; esac; case "$value" in \"*\") value=${value#\"}; value=${value%\"};; \'*\') value=${value#\'}; value=${value%\'};; esac; record_dependency "environment:$key" "$value" "$path"; pending=''; }; done <"$path"; [ -z "$pending" ] || die 'malformed recovery EnvironmentFile'
}
recovery_process_identity() {
  pid=$1; recovery_safe_int "$pid" || die 'invalid process pid'
  cgroup="$RECOVERY_PROC_ROOT/$pid/cgroup"; namespace="$RECOVERY_PROC_ROOT/$pid/ns/pid"
  [ -f "$cgroup" ] && [ ! -L "$cgroup" ] && [ -e "$namespace" ] || die "process identity unavailable $pid"
  namespace_value=$(readlink -- "$namespace") || die "process namespace unavailable $pid"; printf '%s %s\n' "$(sha "$cgroup")" "$(hash_text "$namespace_value")"
}
recovery_is_scanner_ancestor() {
  case " ${RECOVERY_SCANNER_PID_SET:-} " in *" $1 "*) return 0;; *) return 1;; esac
}
recovery_seen_flag() {
  case " ${2:-} " in *" $1 "*) return 0;; *) return 1;; esac
}
recovery_build_scanner_ancestors() {
  current=$RECOVERY_SELF_PID; hops=0; pids=''; entries='[]'
  while recovery_safe_int "$current" && [ "$hops" -lt 64 ]; do
    line=$(awk -v pid="$current" '$1 == pid { print; exit }' "$RECOVERY_PROCESS_FILE") || die 'scanner ancestry read failed'
    [ -n "$line" ] || die 'scanner ancestry missing'
    IFS=' ' read -r pid ppid args <<EOF
$line
EOF
    if [ "$pid" != "$current" ] || ! recovery_safe_int "$pid" || ! recovery_nonnegative_int "$ppid"; then die 'scanner ancestry pid binding failed'; fi
    identity=$(recovery_process_identity "$pid"); IFS=' ' read -r cgroup namespace extra <<EOF
$identity
EOF
    [ -z "${extra:-}" ] && [ -n "$cgroup" ] && [ -n "$namespace" ] || die 'scanner ancestry identity failed'
    ancestor_exe="$RECOVERY_PROC_ROOT/$pid/exe"; [ -L "$ancestor_exe" ] || review_required 'scanner ancestor executable missing'; ancestor_real=$(readlink -f -- "$ancestor_exe") || review_required 'scanner ancestor executable unresolved'; [ -x "$ancestor_real" ] && [ ! -L "$ancestor_real" ] || review_required 'scanner ancestor executable unsafe'
    ancestor_stat=$(stat -Lc '%d:%i:%u:%g:%a' "$ancestor_exe") || review_required 'scanner ancestor executable identity failed'; ancestor_uid=$(awk '/^Uid:/{print $2; exit}' "$RECOVERY_PROC_ROOT/$pid/status"); ancestor_start=$(sed 's/.*) //' "$RECOVERY_PROC_ROOT/$pid/stat" | awk '{print $20}')
    if ! recovery_nonnegative_int "$ancestor_uid" || ! recovery_safe_int "$ancestor_start"; then review_required 'scanner ancestor lifetime identity failed'; fi
    entries=$(/usr/bin/jq -cn --argjson old "$entries" --arg pid "$pid" --arg ppid "$ppid" --arg args "$(hash_text "$args")" --arg cgroup "$cgroup" --arg namespace "$namespace" --arg executable "$ancestor_real" --arg digest "$(sha "$ancestor_exe")" --arg identity "$(hash_text "$ancestor_stat")" --arg uid "$ancestor_uid" --arg start "$ancestor_start" '$old + [{pid:$pid,ppid:$ppid,argsSha256:$args,cgroupSha256:$cgroup,pidNamespaceSha256:$namespace,executable:{path:$executable,sha256:$digest,identitySha256:$identity,uid:$uid,startTime:$start}}]') || die 'scanner ancestry serialization failed'
    pids="$pids $pid"; [ "$pid" = 1 ] && break
    current=$ppid; hops=$((hops + 1))
  done
  RECOVERY_SCANNER_PID_SET=$pids; RECOVERY_SCANNER_ANCESTORS=$entries
}
recovery_process_executable() {
  pid=$1; expected=$2; kind=$3; exe="$RECOVERY_PROC_ROOT/$pid/exe"; [ -L "$exe" ] || review_required 'process executable link missing'
  observed=$(readlink -- "$exe") || review_required 'process executable target unavailable'; observed=${observed% (deleted)}
  real=$(readlink -f -- "$exe") || review_required 'process executable resolution failed'
  case "$kind:$real" in
    ollama:*)
      expected_path="$RECOVERY_PROC_ROOT/$pid/root$expected"
      expected_real=$(readlink -f -- "$expected_path") || review_required 'process executable expectation unresolved'
      expected_identity=$(stat -Lc '%d:%i:%u:%g:%a' "$expected_path") || review_required 'process executable expectation identity failed'
      observed_identity=$(stat -Lc '%d:%i:%u:%g:%a' "$exe") || review_required 'process executable identity failed'; [ "$expected_identity" = "$observed_identity" ] || review_required 'process executable mismatch'
      [ -n "$expected_real" ] || review_required 'process executable expectation unresolved';;
    docker-proxy:/usr/bin/docker-proxy|docker-proxy:/usr/libexec/docker/docker-proxy) :;;
    *) review_required 'unreviewed process executable path';;
  esac
  stat_value=$(stat -Lc '%d:%i:%u:%g:%a' "$exe") || review_required 'process executable identity failed'
  start_value=$(sed 's/.*) //' "$RECOVERY_PROC_ROOT/$pid/stat" | awk '{print $20}')
  uid_value=$(awk '/^Uid:/{print $2; exit}' "$RECOVERY_PROC_ROOT/$pid/status")
  if ! recovery_safe_int "$start_value" || ! recovery_nonnegative_int "$uid_value" || { [ "$kind" = docker-proxy ] && [ "$uid_value" != 0 ]; }; then review_required 'process executable lifetime identity failed'; fi
  /usr/bin/jq -cn --arg path "$observed" --arg real "$real" --arg digest "$(sha "$exe")" --arg identity "$(hash_text "$stat_value")" --arg uid "$uid_value" --arg start "$start_value" --arg expected "$expected" --arg kind "$kind" '{path:$path,realPath:$real,sha256:$digest,identitySha256:$identity,uid:$uid,startTime:$start,expected:$expected,kind:$kind}'
}
recovery_proxy_ports_ok() {
  args=$1; ports=$2; proto=''; host_ip=''; host_port=''; container_ip=''; container_port=''; seen=''; set -f
  # shellcheck disable=SC2086 # Deliberate argv tokenization of ps output with globbing disabled.
  set -- $args
  set +f
  command=${1:-}; shift || return 1
  case "$command" in docker-proxy|*/docker-proxy) :;; *) return 1;; esac
  while [ "$#" -gt 0 ]; do
    key=$1; shift
    case "$key" in
      -proto=*) [ -z "$proto" ] || return 1; proto=${key#-proto=};;
      -host-ip=*) recovery_seen_flag host-ip "$seen" && return 1; seen="$seen host-ip"; host_ip=${key#-host-ip=};;
      -host-port=*) recovery_seen_flag host-port "$seen" && return 1; seen="$seen host-port"; host_port=${key#-host-port=};;
      -container-ip=*) recovery_seen_flag container-ip "$seen" && return 1; seen="$seen container-ip"; container_ip=${key#-container-ip=};;
      -container-port=*) recovery_seen_flag container-port "$seen" && return 1; seen="$seen container-port"; container_port=${key#-container-port=};;
      -proto|-host-ip|-host-port|-container-ip|-container-port) [ "$#" -gt 0 ] || return 1; value=$1; shift; case "$key" in -proto) [ -z "$proto" ] || return 1; proto=$value;; -host-ip) recovery_seen_flag host-ip "$seen" && return 1; seen="$seen host-ip"; host_ip=$value;; -host-port) recovery_seen_flag host-port "$seen" && return 1; seen="$seen host-port"; host_port=$value;; -container-ip) recovery_seen_flag container-ip "$seen" && return 1; seen="$seen container-ip"; container_ip=$value;; -container-port) recovery_seen_flag container-port "$seen" && return 1; seen="$seen container-port"; container_port=$value;; esac;;
      *) return 1;;
    esac
  done
  [ -n "$host_port" ] && [ -n "$container_port" ] || return 1
  if [ "$host_port" != 11434 ] && [ "$container_port" != 11434 ]; then return 2; fi
  [ "$proto" = tcp ] && [ "$host_ip" = 127.0.0.1 ] && [ "$host_port" = 11434 ] && [ -n "$container_ip" ] && [ "$container_port" = 11434 ] || return 1
  /usr/bin/jq -e --arg hostIp "$host_ip" --arg hostPort "$host_port" --arg containerIp "$container_ip" '
    (any((.NetworkSettings.Ports["11434/tcp"] // [])[]?; ((.HostPort // "") == $hostPort) and ((.HostIp // "0.0.0.0") == $hostIp))) and
    (any((.NetworkSettings.Networks // {})[]?; (.IPAddress // "") == $containerIp))
  ' "$ports" >/dev/null 2>&1
}
recovery_container_ports_ok() {
  ports=$1; /usr/bin/jq -e '(any((.HostConfig.PortBindings["11434/tcp"] // [])[]?; ((.HostPort // "") == "11434") and ((.HostIp // "0.0.0.0") == "127.0.0.1"))) and (any((.NetworkSettings.Ports["11434/tcp"] // [])[]?; ((.HostPort // "") == "11434") and ((.HostIp // "0.0.0.0") == "127.0.0.1"))) and (any((.NetworkSettings.Networks // {})[]?; (.IPAddress // "") != ""))' "$ports" >/dev/null 2>&1
}
recovery_process_snapshot() {
  container_pid=$1; container_cgroup=$2; container_namespace=$3; ports=$4; processes=$5
  RECOVERY_PROCESS_FILE=$processes; RECOVERY_SELF_PID=${RECOVERY_SELF_PID:-$$}; RECOVERY_SCANNER_PID_SET=''; RECOVERY_SCANNER_ANCESTORS='[]'; RECOVERY_CONTAINER_PROCESS_UID=''
  if awk -v pid="$RECOVERY_SELF_PID" '$1 == pid { found=1 } END { exit(found ? 0 : 1) }' "$processes"; then recovery_build_scanner_ancestors; fi
  recovery_socket_snapshot "$container_pid" "$container_cgroup" "$container_namespace" "$ports" "$processes"
  entries='[]'; count=0; container_count=0; proxy_count=0; container_pid_seen=0
  while IFS=' ' read -r pid ppid args || [ -n "$pid$ppid$args" ]; do
    [ -n "$pid" ] || continue
    if ! recovery_safe_int "$pid" || ! recovery_nonnegative_int "$ppid"; then review_required 'invalid process pid binding'; fi
    command=${args%% *}; rest=${args#"$command"}; base=${command##*/}; class=''
    case "$base" in
      ollama) case "$rest" in ' serve'|' serve '*) class=ollama-process;; ' runner'|' runner '*) class=ollama-process;; *) review_required 'unsupported Ollama process';; esac;;
      docker-proxy) class=docker-proxy;;
      *)
        case "$args" in *ollama*|*11434*) recovery_is_scanner_ancestor "$pid" || review_required 'foreign Ollama process refused';; esac
        continue;;
    esac
    identity=$(recovery_process_identity "$pid"); IFS=' ' read -r cgroup namespace extra <<EOF
$identity
EOF
    [ -z "${extra:-}" ] && [ -n "$cgroup" ] && [ -n "$namespace" ] || review_required 'invalid process identity'
    binding='container'
    if [ "$class" = docker-proxy ]; then
      if recovery_proxy_ports_ok "$args" "$ports"; then :; else status=$?; [ "$status" -eq 2 ] && continue; review_required 'Docker proxy is not bound to the reviewed container'; fi
      binding='container-port-11434/tcp'; proxy_count=$((proxy_count + 1))
    else
      [ "$cgroup" = "$container_cgroup" ] && [ "$namespace" = "$container_namespace" ] || review_required 'foreign Ollama process refused'; [ "$pid" = "$container_pid" ] && container_pid_seen=1
      container_count=$((container_count + 1))
    fi
    if [ "$class" = docker-proxy ]; then executable=$(recovery_process_executable "$pid" docker-proxy docker-proxy); else executable=$(recovery_process_executable "$pid" "$RECOVERY_CONTAINER_COMMAND_PATH" ollama); process_uid=$(/usr/bin/jq -er .uid <<EOF
$executable
EOF
); if [ -z "$RECOVERY_CONTAINER_PROCESS_UID" ]; then RECOVERY_CONTAINER_PROCESS_UID=$process_uid; elif [ "$RECOVERY_CONTAINER_PROCESS_UID" != "$process_uid" ]; then review_required 'container process uid drift'; fi; fi
    entries=$(/usr/bin/jq -cn --argjson old "$entries" --argjson executable "$executable" --arg pid "$pid" --arg ppid "$ppid" --arg class "$class" --arg cgroup "$cgroup" --arg namespace "$namespace" --arg binding "$binding" --arg args "$(hash_text "$args")" '$old + [{pid:$pid,ppid:$ppid,class:$class,cgroupSha256:$cgroup,pidNamespaceSha256:$namespace,binding:$binding,executable:$executable,argsSha256:$args}]') || die 'process receipt serialization failed'
    count=$((count + 1))
  done <"$processes"
  [ "$container_count" -gt 0 ] || review_required 'incomplete reviewed Ollama process set'; [ "$container_pid_seen" -eq 1 ] || review_required 'inspected container process missing'; [ "$proxy_count" -gt 0 ] || recovery_container_ports_ok "$ports" || review_required 'published Ollama binding is not loopback-bound'
  /usr/bin/jq -cn --arg pid "$container_pid" --arg cgroup "$container_cgroup" --arg namespace "$container_namespace" --arg uid "${RECOVERY_CONTAINER_PROCESS_UID:-}" --arg socketDigest "$RECOVERY_SOCKET_SNAPSHOT_SHA" --argjson entries "$entries" --argjson ancestors "${RECOVERY_SCANNER_ANCESTORS:-[]}" --argjson listeners "$RECOVERY_LISTENING_SOCKETS" --argjson containers "$container_count" --argjson proxies "$proxy_count" '{containerPid:$pid,containerCgroupSha256:$cgroup,containerPidNamespaceSha256:$namespace,containerUid:$uid,matchingProcesses:$entries,listeningSockets:$listeners,socketSnapshotSha256:$socketDigest,scannerAncestors:$ancestors,containerProcessCount:$containers,proxyProcessCount:$proxies}'
}
recovery_cron_snapshot() {
  cron=$1; [ -f "$cron" ] && [ ! -L "$cron" ] || die 'unsafe recovery crontab'
  lines=$(temp_path); grouped=$(temp_path); entries='[]'; count=0
  while IFS= read -r line || [ -n "$line" ]; do hash_text "$line" >>"$lines" || die 'cron line digest failed'; count=$((count + 1)); done <"$cron"
  sort "$lines" | uniq -c >"$grouped" || { rm -f "$lines" "$grouped"; die 'cron digest grouping failed'; }
  while IFS=' ' read -r number digest || [ -n "$number$digest" ]; do [ -n "$digest" ] || continue; entries=$(/usr/bin/jq -cn --argjson old "$entries" --arg sha "$digest" --argjson count "$number" '$old + [{sha256:$sha,count:$count}]') || die 'cron receipt serialization failed'; done <"$grouped"
  whole=$(sha "$cron"); rm -f "$lines" "$grouped"
  /usr/bin/jq -cn --arg whole "$whole" --argjson count "$count" --argjson entries "$entries" '{wholeSha256:$whole,lineCount:$count,lines:$entries}'
}
recovery_model_snapshot() {
  if [ ! -e "$STORE" ] && [ ! -L "$STORE" ]; then /usr/bin/jq -cn '{state:"absent"}'; return; fi
  [ -d "$STORE" ] && [ ! -L "$STORE" ] || die 'unsafe recovery model store'
  real=$(readlink -f -- "$STORE") || die 'cannot resolve recovery model store'; [ "$real" = "$STORE" ] || die 'replaced recovery model store'
  parent=$(dirname "$STORE"); parent_real=$(readlink -f -- "$parent") || die 'cannot resolve recovery model parent'; [ "$parent_real" = "$parent" ] || die 'replaced recovery model parent'
  [ ! -L "$parent" ] || die 'unsafe recovery model parent'
  parent_identity=$(stat -c '%d:%i:%u:%g:%a' "$parent") || die 'recovery model parent identity failed'; IFS=: read -r parent_device parent_inode parent_uid parent_gid parent_mode <<EOF
$parent_identity
EOF
  case "$parent_mode" in ''|*[!0-7]*) die 'invalid recovery model parent mode';; esac; [ $((0$parent_mode & 022)) -eq 0 ] || die 'writable recovery model parent'
  identity=$(stat -c '%d:%i:%u:%g:%a' "$STORE") || die 'recovery model identity failed'; IFS=: read -r device inode uid gid mode <<EOF
$identity
EOF
  listing=$(temp_path); sorted=$(temp_path); mount=$(temp_path)
  find "$STORE" -xdev -printf '%y:%m:%s:%T@:%p\n' >"$listing" || die 'recovery model listing failed'; sort "$listing" >"$sorted" || die 'recovery model sort failed'; tree=$(sha "$sorted")
  findmnt -no TARGET,SOURCE,FSTYPE,OPTIONS --target "$STORE" >"$mount" || die 'recovery model mount scan failed'; mount_sha=$(sha "$mount"); rm -f "$listing" "$sorted" "$mount"
  /usr/bin/jq -cn --arg path "$real" --arg parent "$parent_real" --arg device "$device" --arg inode "$inode" --arg uid "$uid" --arg gid "$gid" --arg mode "$mode" --arg pdevice "$parent_device" --arg pinode "$parent_inode" --arg puid "$parent_uid" --arg pgid "$parent_gid" --arg pmode "$parent_mode" --arg mount "$mount_sha" --arg tree "$tree" '{realPath:$path,parent:{realPath:$parent,device:$pdevice,inode:$pinode,uid:$puid,gid:$pgid,mode:$pmode},device:$device,inode:$inode,mountSha256:$mount,treeSha256:$tree,owner:{uid:$uid,gid:$gid,mode:$mode}}'
}
recovery_container_snapshot() {
  json=$(temp_path); error=$(temp_path)
# shellcheck disable=SC2153 # CONTAINER is defined by the sourced entrypoint.
  if recovery_docker inspect -f '{{json .}}' "$CONTAINER" >"$json" 2>"$error"; then :; else
    status=$?; if [ "$status" -eq 1 ] && grep -Fqx "Error: No such object: $CONTAINER" "$error"; then
      listed=$(temp_path); recovery_docker ps -a --no-trunc --format '{{.Names}}' >"$listed" 2>/dev/null || { rm -f "$json" "$error" "$listed"; die 'recovery container absence verification failed'; }
      grep -Fqx "$CONTAINER" "$listed" && { rm -f "$json" "$error" "$listed"; die 'recovery container changed during absence verification'; }
      rm -f "$json" "$error" "$listed"; RECOVERY_CONTAINER_STATE=absent; /usr/bin/jq -cn '{name:"ollama-loopback",state:"absent"}'; return
    fi
    rm -f "$json" "$error"; die "recovery container inspection failed ($status)"
  fi; rm -f "$error"
  /usr/bin/jq -e 'type == "object" and .Name == "/ollama-loopback" and (.Id|type == "string" and test("^[0-9a-f]{64}$")) and (.Image|type == "string" and test("^sha256:[0-9a-f]{64}$")) and (.Path|type == "string" and test("^/[A-Za-z0-9._+@/-]*ollama$")) and (.State|type == "object") and (.State.Running|type == "boolean") and (.State.Pid|type == "number" and floor == . and . >= 0) and ((.State.Running and .State.Pid > 0) or ((.State.Running|not) and .State.Pid == 0))' "$json" >/dev/null || { rm -f "$json"; die 'invalid recovery container snapshot'; }
  id=$(/usr/bin/jq -er '.Id' "$json"); image=$(/usr/bin/jq -er '.Image' "$json"); path=$(/usr/bin/jq -er '.Path' "$json"); pid=$(/usr/bin/jq -er '.State.Pid' "$json"); running=$(/usr/bin/jq -r '.State.Running' "$json")
  config_file=$(temp_path); /usr/bin/jq -S -c '{Config,HostConfig,Mounts,Networks:.NetworkSettings.Networks}' "$json" >"$config_file" || die 'recovery container config failed'; config=$(sha "$config_file"); rm -f "$config_file"
  ports_file=$(temp_path); /usr/bin/jq -S '{HostConfig:{PortBindings:.HostConfig.PortBindings},NetworkSettings:{Ports:.NetworkSettings.Ports,Networks:.NetworkSettings.Networks}}' "$json" >"$ports_file" || die 'recovery container ports failed'; ports_sha=$(sha "$ports_file")
  cgroup=; namespace=; state=stopped
  if [ "$running" = true ]; then identity=$(recovery_process_identity "$pid"); IFS=' ' read -r cgroup namespace extra <<EOF
$identity
EOF
    [ -z "${extra:-}" ] && [ -n "$cgroup" ] && [ -n "$namespace" ] || die 'invalid container process identity'; state=running
  fi
  RECOVERY_CONTAINER_STATE=$state RECOVERY_CONTAINER_COMMAND_PATH=$path RECOVERY_CONTAINER_PID=$pid RECOVERY_CONTAINER_CGROUP=$cgroup RECOVERY_CONTAINER_NAMESPACE=$namespace RECOVERY_CONTAINER_PORTS_FILE=$ports_file
  /usr/bin/jq -cn --arg id "$id" --arg image "$image" --arg path "$path" --arg pid "$pid" --arg state "$state" --arg config "$config" --arg ports "$ports_sha" '{name:"ollama-loopback",state:$state,fullId:$id,imageId:$image,commandPath:$path,pid:$pid,configSha256:$config,portsSha256:$ports}'
  rm -f "$json"
}
recovery_record_environment_property() {
  file=$1; set -f; tokens=$(cat "$file") || die 'recovery EnvironmentFiles read failed'; # shellcheck disable=SC2086
  set -- $tokens; set +f
  while [ "$#" -gt 0 ]; do item=$1; shift; optional=0; case "$item" in -/*) optional=1; item=${item#-};; /*) :;; *) die 'malformed recovery EnvironmentFiles path';; esac; [ "$#" -gt 0 ] || die 'missing recovery EnvironmentFiles annotation'; annotation=$1; shift; case "$annotation" in '(ignore_errors=no)') [ "$optional" -eq 0 ] || die 'recovery EnvironmentFiles optionality drift';; '(ignore_errors=yes)') optional=1;; *) die 'unknown recovery EnvironmentFiles annotation';; esac; recovery_record_environment "$item" "$optional"; done
}
recovery_collect_crontab() {
  target=$1
  if crontab -u "$OWNER" -l >"$target" 2>/dev/null; then :; else status=$?; [ "$status" -eq 1 ] || die 'recovery crontab scan failed'; : >"$target"; fi
}
recovery_collect_systemd() {
# shellcheck disable=SC2153 # UNIT is defined by the sourced entrypoint.
  recovery_surface systemd-definitions recovery_systemctl cat "$UNIT"
# shellcheck disable=SC2153 # TIMER is defined by the sourced entrypoint.
  recovery_surface systemd-timer-definitions recovery_systemctl cat "$TIMER"
  recovery_surface systemd-consumers scan_systemd_consumers
  for name in "$UNIT" "$TIMER"; do for property in FragmentPath DropInPaths EnvironmentFiles; do
      out=$(temp_path); if recovery_systemd_properties "$name" "$property" "$out"; then status=0; else status=$?; fi
      value=$(sha "$out")
      RECOVERY_RECORDS=$(/usr/bin/jq -cn --argjson old "$RECOVERY_RECORDS" --arg class "systemd-$property" --arg name "$name" --argjson status "$status" --arg value "$value" '$old + [{class:$class,unit:$name,exitStatus:$status,sha256:$value}]')
      if [ "$status" -eq 0 ]; then
        case "$property" in
          FragmentPath) path=$(cat "$out"); [ -z "$path" ] || recovery_record_path systemd-fragment "$path" 0;;
          DropInPaths) tokens=$(temp_path); awk '{ for (i=1; i<=NF; i++) print $i }' "$out" >"$tokens"; while IFS= read -r path || [ -n "$path" ]; do [ -z "$path" ] || recovery_record_path systemd-drop-in "$path" 0; done <"$tokens"; rm -f "$tokens";;
          EnvironmentFiles) recovery_record_environment_property "$out";;
        esac
      fi
      rm -f "$out"; done
  done; :
}
recovery_collect_processes() { processes=$1; recovery_ps >"$processes" || die 'recovery process scan failed'; recovery_surface running-processes cat "$processes"; }
recovery_absent_process_snapshot() { processes=$1; RECOVERY_PROCESS_FILE=$processes; RECOVERY_SELF_PID=${RECOVERY_SELF_PID:-$$}; RECOVERY_SCANNER_PID_SET=''; if awk -v pid="$RECOVERY_SELF_PID" '$1 == pid { found=1 } END { exit(found ? 0 : 1) }' "$processes"; then recovery_build_scanner_ancestors; fi; recovery_socket_snapshot '' '' '' '' "$processes"; while IFS=' ' read -r pid ppid args || [ -n "$pid$ppid$args" ]; do [ -n "$pid" ] || continue; command=${args%% *}; base=${command##*/}; case "$base" in ollama) review_required 'foreign Ollama process remains after container removal';; esac; case "$args" in *ollama*|*11434*) recovery_is_scanner_ancestor "$pid" || review_required 'foreign Ollama process remains after container removal';; esac; recovery_is_scanner_ancestor "$pid" && continue; done <"$processes"; /usr/bin/jq -cn --arg socketDigest "$RECOVERY_SOCKET_SNAPSHOT_SHA" --argjson listeners "$RECOVERY_LISTENING_SOCKETS" '{state:"absent",matchingProcesses:[],listeningSockets:$listeners,socketSnapshotSha256:$socketDigest}'; }
recovery_scan() {
  root; init_temp_root; trap 'cleanup_temp' EXIT HUP INT TERM; assert_docker_socket; RECOVERY_SELF_PID=$$; RECOVERY_CONTAINER_PORTS_FILE=''
  if [ "$(id -u)" -ne 0 ] && [ -n "${RETIRE_OLLAMA_TEST_BIN:-}" ] && [ -n "${RETIRE_OLLAMA_RECOVERY_TEST_SOURCE_SHA:-}" ]; then RECOVERY_SOURCE_SHA=$RETIRE_OLLAMA_RECOVERY_TEST_SOURCE_SHA; fi
  recovery_source_identity "$RECOVERY_SOURCE_SHA" || die 'invalid recovery source identity'
  RECOVERY_RECORDS='[]'; deps='[]'; consumer_counts='[]'; consumer_evidence='[]'
  snapshot=$(temp_path); cron=$(temp_path); processes=$(temp_path); container=$(temp_path)
  recovery_collect_systemd
  recovery_surface reverse-proxy scan_nginx_definitions; recovery_surface compose-definitions scan_compose_definitions
  recovery_surface container-definitions scan_container_definitions; recovery_surface running-containers scan_running_containers
  recovery_container_snapshot >"$container"
  recovery_collect_processes "$processes"
  case "${RECOVERY_CONTAINER_STATE:-}" in absent|stopped) process_json=$(recovery_absent_process_snapshot "$processes");; running) process_json=$(recovery_process_snapshot "$RECOVERY_CONTAINER_PID" "$RECOVERY_CONTAINER_CGROUP" "$RECOVERY_CONTAINER_NAMESPACE" "$RECOVERY_CONTAINER_PORTS_FILE" "$processes");; *) die 'invalid recovery container state';; esac
  recovery_collect_crontab "$cron"; recovery_surface current-crontab cat "$cron"
  package=$(recovery_package_snapshot); unit=$(recovery_unit_snapshot "$UNIT"); timer=$(recovery_unit_snapshot "$TIMER"); model=$(recovery_model_snapshot); cron_json=$(recovery_cron_snapshot "$cron"); container_json=$(cat "$container")
  records=$RECOVERY_RECORDS; record_docker_socket; RECOVERY_RECORDS=$records; recovery_surface docker-daemon docker --host "unix://$CANONICAL_DOCKER_SOCKET" info --format '{{.ServerVersion}} {{.Driver}} {{.DockerRootDir}}'
  /usr/bin/jq -S -n --argjson package "$package" --argjson unit "$unit" --argjson timer "$timer" --argjson container "$container_json" --argjson model "$model" --argjson cron "$cron_json" --argjson processes "$process_json" --argjson records "$RECOVERY_RECORDS" --argjson dependencies "$deps" --argjson consumerCounts "$consumer_counts" --argjson consumerEvidence "$consumer_evidence" '{package:$package,units:[$unit,$timer],container:$container,model:$model,crontab:$cron,processes:$processes,surfaces:$records,dependencies:$dependencies,consumerCounts:$consumerCounts,consumerEvidence:$consumerEvidence,dependencyTaxonomy:["disabled","external-provider","ollama-loopback","unknown"]}' >"$snapshot" || die 'recovery snapshot serialization failed'
  recovery_write_receipt "$snapshot"; rm -f "$snapshot" "$cron" "$processes" "$container"; [ -z "${RECOVERY_CONTAINER_PORTS_FILE:-}" ] || rm -f "$RECOVERY_CONTAINER_PORTS_FILE"
}
