#!/bin/sh
set -eu

[ "$#" -eq 0 ]
uid_ok=false
gid_ok=false
cpuset_ok=false
cgroup_ok=false
resources_ok=false
shm_ok=false
root_ok=false
policy_get() {
  /opt/node/bin/node /opt/baci-cwv/policy.schema.mjs get "$1"
}
runner_uid=$(policy_get '/host/runnerUid')
runner_gid=$(policy_get '/host/runnerGid')
[ "$(id -u)" -eq "$runner_uid" ] && uid_ok=true
[ "$(id -g)" -eq "$runner_gid" ] && gid_ok=true
measurement_cpuset=$(policy_get '/resources/measurementCpuSet')
memory_bytes=$(policy_get '/resources/memoryBytes')
memory_swap_bytes=$(policy_get '/resources/memorySwapBytes')
pids_limit=$(policy_get '/resources/pidsLimit')
shm_bytes=$(policy_get '/resources/shmBytes')

cgroup_path=$(awk -F: '$1 == "0" { print $3 }' /proc/self/cgroup)
case "$cgroup_path" in
  /*) cgroup_ok=true ;;
esac
effective_cpuset=/sys/fs/cgroup${cgroup_path}/cpuset.cpus.effective
[ -r "$effective_cpuset" ] && [ "$(tr -d '\n' <"$effective_cpuset")" = "$measurement_cpuset" ] && cpuset_ok=true
memory_max=/sys/fs/cgroup${cgroup_path}/memory.max
memory_swap_max=/sys/fs/cgroup${cgroup_path}/memory.swap.max
pids_max=/sys/fs/cgroup${cgroup_path}/pids.max
[ -r "$memory_max" ] && [ "$(cat "$memory_max")" = "$memory_bytes" ] &&
  [ -r "$memory_swap_max" ] && [ "$(cat "$memory_swap_max")" = "$memory_swap_bytes" ] &&
  [ -r "$pids_max" ] && [ "$(cat "$pids_max")" = "$pids_limit" ] && resources_ok=true
shm_values=$(stat -fc '%S %b' /dev/shm)
shm_block_size=${shm_values% *}
shm_blocks=${shm_values#* }
[ "$((shm_block_size * shm_blocks))" -eq "$shm_bytes" ] && shm_ok=true
findmnt -n -o OPTIONS / | tr ',' '\n' | grep -qx ro && root_ok=true

printf '{"cgroup":%s,"cpuset":%s,"gid":%s,"readOnlyRoot":%s,"resources":%s,"shm":%s,"uid":%s}\n' \
  "$cgroup_ok" "$cpuset_ok" "$gid_ok" "$root_ok" "$resources_ok" "$shm_ok" "$uid_ok"
[ "$uid_ok" = true ] && [ "$gid_ok" = true ] && [ "$cpuset_ok" = true ] &&
  [ "$cgroup_ok" = true ] && [ "$resources_ok" = true ] && [ "$shm_ok" = true ] &&
  [ "$root_ok" = true ]
