#!/bin/sh
# Running-container validation never uses docker cp. Stopped-container file
# closure remains in retire-ollama-consumer-closure.sh.

running_container_pair() {
  running_pair_id=$1
  running_pair_format=$2
  running_pair_first=$3
  running_pair_second=$4
  if [ "$running_pair_format" = '{{json .Mounts}}' ]; then
    container_mounts_snapshot "$running_pair_id" "$running_pair_first" || return 2
    container_mounts_snapshot "$running_pair_id" "$running_pair_second" || return 2
  else
    docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f "$running_pair_format" "$running_pair_id" >"$running_pair_first" || return 2
    docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f "$running_pair_format" "$running_pair_id" >"$running_pair_second" || return 2
  fi
  cmp -s "$running_pair_first" "$running_pair_second" || return 2
}

container_mounts_snapshot() {
  mount_container_id=$1
  mount_output=$2
  mount_raw=$(temp_path)
  docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .Mounts}}' "$mount_container_id" >"$mount_raw" || { rm -f "$mount_raw"; return 2; }
  /usr/bin/jq -cS 'if type == "array" and all(.[]; type == "object") then sort_by([.Destination, .Type, .Name, .Source, .Driver, .Mode, .RW, .Propagation]) else error("invalid mounts") end' "$mount_raw" >"$mount_output" || { rm -f "$mount_raw" "$mount_output"; return 2; }
  rm -f "$mount_raw"
}

running_container_validate_json() {
  running_json_file=$1
  running_json_kind=$2
  case "$running_json_kind" in
    path)
      /usr/bin/jq -e 'type == "string" and if startswith("/") then test("^/[A-Za-z0-9._/-]+$") and (test("(^|/)\\.\\.?(/|$)") | not) else test("^[A-Za-z0-9][A-Za-z0-9._+-]*$") and . != "." and . != ".." end' "$running_json_file" >/dev/null || return 2
      ;;
    args)
      /usr/bin/jq -e 'type == "array" and length <= 256 and all(.[]; type == "string" and ((startswith("/") | not) or (test("^/[A-Za-z0-9._/-]+$") and (test("(^|/)\\.\\.?(/|$)") | not))))' "$running_json_file" >/dev/null || return 2
      ;;
    env)
      /usr/bin/jq -e 'type == "array" and length <= 256 and all(.[]; type == "string" and test("^[A-Za-z_][A-Za-z0-9_]*=") and ((test("[\u0000-\u001f]") | not) or test("^DOCKER_PG_LLVM_DEPS=[A-Za-z0-9.+_-]+([ \\t]+[A-Za-z0-9.+_-]+)*$")))' "$running_json_file" >/dev/null || return 2
      ;;
    health)
      /usr/bin/jq -e 'if . == null then true elif type != "object" or (.Test|type) != "array" or any(.Test[]; type != "string") then false elif .Test == ["NONE"] then true elif .Test[0] == "CMD-SHELL" and (.Test|length) == 2 and (.Test[1]|length) > 0 then true elif .Test[0] == "CMD" and (.Test|length) >= 2 then true else false end' "$running_json_file" >/dev/null || return 2
      ;;
    mounts)
      /usr/bin/jq -e 'type == "array" and all(.[]; type == "object")' "$running_json_file" >/dev/null || return 2
      ;;
    *) return 2 ;;
  esac
}

running_container_socket_env_matches() {
  running_socket_id=$1
  running_socket_env=$2
  [ "$running_socket_env" = /run/docker.sock ] || [ "$running_socket_env" = /var/run/docker.sock ] || return 2
  running_socket_mounts=$(temp_path)
  running_socket_mounts_again=$(temp_path)
  running_container_pair "$running_socket_id" '{{json .Mounts}}' "$running_socket_mounts" "$running_socket_mounts_again" || { rm -f "$running_socket_mounts" "$running_socket_mounts_again"; return 2; }
  /usr/bin/jq -e --arg destination "$running_socket_env" 'any(.[]; type == "object" and .Type == "bind" and (.Source == "/run/docker.sock" or .Source == "/var/run/docker.sock") and .Destination == $destination)' "$running_socket_mounts" >/dev/null || { rm -f "$running_socket_mounts" "$running_socket_mounts_again"; return 2; }
  rm -f "$running_socket_mounts" "$running_socket_mounts_again"
}

running_container_validate() {
  running_id=$1
  running_name=$2
  running_configuration=$3
  running_name_first=$(temp_path); running_name_second=$(temp_path)
  running_state_first=$(temp_path); running_state_second=$(temp_path)
  running_image_first=$(temp_path); running_image_second=$(temp_path)
  running_path_first=$(temp_path); running_path_second=$(temp_path)
  running_working_first=$(temp_path); running_working_second=$(temp_path)
  running_args_first=$(temp_path); running_args_second=$(temp_path)
  running_env_first=$(temp_path); running_env_second=$(temp_path)
  running_health_first=$(temp_path); running_health_second=$(temp_path)
  running_mounts_first=$(temp_path); running_mounts_second=$(temp_path)
  running_image_save_first=''; running_image_save_fifo=''; running_image_save_status=''; running_image_hash=''; running_image_hash_fifo=''; running_image_hash_status=''
  running_filesystem_save_first=''; running_filesystem_save_fifo=''; running_filesystem_save_status=''; running_filesystem_hash=''; running_filesystem_hash_fifo=''; running_filesystem_hash_status=''
  running_cleanup() { rm -f "$running_name_first" "$running_name_second" "$running_state_first" "$running_state_second" "$running_image_first" "$running_image_second" "$running_path_first" "$running_path_second" "$running_working_first" "$running_working_second" "$running_args_first" "$running_args_second" "$running_env_first" "$running_env_second" "$running_health_first" "$running_health_second" "$running_mounts_first" "$running_mounts_second" ${running_image_save_first:-} ${running_image_save_fifo:-} ${running_image_save_status:-} ${running_image_hash:-} ${running_image_hash_fifo:-} ${running_image_hash_status:-} ${running_filesystem_save_first:-} ${running_filesystem_save_fifo:-} ${running_filesystem_save_status:-} ${running_filesystem_hash:-} ${running_filesystem_hash_fifo:-} ${running_filesystem_hash_status:-}; }
  running_container_pair "$running_id" '{{.Name}}' "$running_name_first" "$running_name_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .State.Running}}' "$running_state_first" "$running_state_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{.Image}}' "$running_image_first" "$running_image_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .Path}}' "$running_path_first" "$running_path_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .Config.WorkingDir}}' "$running_working_first" "$running_working_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .Args}}' "$running_args_first" "$running_args_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .Config.Env}}' "$running_env_first" "$running_env_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json (index .Config "Healthcheck")}}' "$running_health_first" "$running_health_second" || { running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .Mounts}}' "$running_mounts_first" "$running_mounts_second" || { running_cleanup; return 2; }
  [ "$(cat "$running_name_first")" = "$running_name" ] || { running_cleanup; return 2; }
  [ "$(cat "$running_state_first")" = true ] || { running_cleanup; return 2; }
  running_image_id=$(cat "$running_image_first")
  printf '%s\n' "$running_image_id" | grep -Eq '^sha256:[0-9a-f]{64}$' || { running_cleanup; return 2; }
  running_container_validate_json "$running_path_first" path || { running_cleanup; return 2; }
  /usr/bin/jq -e 'type == "string" and (. == "" or . == "/" or (test("^/[A-Za-z0-9._/-]+$") and (test("(^|/)\\.\\.?(/|$)") | not)))' "$running_working_first" >/dev/null || { running_cleanup; return 2; }
  running_container_validate_json "$running_args_first" args || { running_cleanup; return 2; }
  running_container_validate_json "$running_env_first" env || { running_cleanup; return 2; }
  running_container_validate_json "$running_health_first" health || { running_cleanup; return 2; }
  running_container_validate_json "$running_mounts_first" mounts || { running_cleanup; return 2; }
  running_env_entries=$(temp_path)
  /usr/bin/jq -r '.[]' "$running_env_first" >"$running_env_entries" || { rm -f "$running_env_entries"; running_cleanup; return 2; }
  running_socket_count=0
  while IFS= read -r running_env_entry || [ -n "$running_env_entry" ]; do
    running_env_name=${running_env_entry%%=*}; running_env_value=${running_env_entry#*=}
    case "$running_env_name:$running_env_value" in
      DOCKER_SOCK:/run/docker.sock|DOCKER_SOCK:/var/run/docker.sock)
        running_socket_count=$((running_socket_count + 1)); [ "$running_socket_count" -eq 1 ] || { rm -f "$running_env_entries"; running_cleanup; return 2; }
        running_container_socket_env_matches "$running_id" "$running_env_value" || { rm -f "$running_env_entries"; running_cleanup; return 2; }
        ;;
      DOCKER_SOCK:*) rm -f "$running_env_entries"; running_cleanup; return 2 ;;
    esac
  done <"$running_env_entries"
  rm -f "$running_env_entries"
  running_configuration_sha=$(hash_text "$running_configuration") || { running_cleanup; return 2; }
  running_metadata_bundle=$(temp_path)
  cat "$running_path_first" "$running_args_first" "$running_env_first" "$running_health_first" >"$running_metadata_bundle" || { rm -f "$running_metadata_bundle"; running_cleanup; return 2; }
  running_metadata_sha=$(sha "$running_metadata_bundle") || { rm -f "$running_metadata_bundle"; running_cleanup; return 2; }
  rm -f "$running_metadata_bundle"
  running_image_cache="$TEMP_ROOT/running-image-${running_image_id#sha256:}.cache"
  if [ -e "$running_image_cache" ] || [ -L "$running_image_cache" ]; then
    [ -f "$running_image_cache" ] && [ ! -L "$running_image_cache" ] || { running_cleanup; return 2; }
    IFS=' ' read -r running_image_sha running_image_match running_image_extra <"$running_image_cache" || { running_cleanup; return 2; }
    printf '%s\n' "$running_image_sha" | grep -Eq '^[0-9a-f]{64}$' && { [ "$running_image_match" = 0 ] || [ "$running_image_match" = 1 ]; } && [ -z "$running_image_extra" ] || { running_cleanup; return 2; }
  else
    running_image_save_first=$(temp_path); running_image_save_fifo=$(temp_path); running_image_save_status=$(temp_path)
    running_image_hash=$(temp_path); running_image_hash_fifo=$(temp_path); running_image_hash_status=$(temp_path)
    running_image_started_at=$(running_container_now) || { running_cleanup; return 2; }
    running_image_deadline=$((running_image_started_at + RUNNING_CONTAINER_IMAGE_SAVE_TIMEOUT_SECONDS))
    running_container_archive_save_bounded image "$running_image_id" "$running_image_save_first" "$running_image_save_fifo" "$running_image_save_status" "$running_image_deadline" || { running_cleanup; return 2; }
    running_image_sha=$(sha "$running_image_save_first") || { running_cleanup; return 2; }
    running_image_second_sha=$(running_container_archive_hash_stream image "$running_image_id" "$running_image_hash" "$running_image_hash_fifo" "$running_image_hash_status" "$running_image_deadline") || { running_cleanup; return 2; }
    [ "$running_image_sha" = "$running_image_second_sha" ] || { running_cleanup; return 2; }
    if consumer_matches "$running_image_save_first"; then running_image_match=1; else running_match_status=$?; [ "$running_match_status" -eq 1 ] || { running_cleanup; return 2; }; running_image_match=0; fi
    running_image_cache_pending=$(temp_path)
    if ! printf '%s %s\n' "$running_image_sha" "$running_image_match" >"$running_image_cache_pending" || ! mv "$running_image_cache_pending" "$running_image_cache"; then
      rm -f "$running_image_cache_pending"; running_cleanup; return 2
    fi
  fi
  running_filesystem_save_first=$(temp_path); running_filesystem_save_fifo=$(temp_path); running_filesystem_save_status=$(temp_path)
  running_filesystem_hash=$(temp_path); running_filesystem_hash_fifo=$(temp_path); running_filesystem_hash_status=$(temp_path)
  running_filesystem_started_at=$(running_container_now) || { running_cleanup; return 2; }
  running_filesystem_deadline=$((running_filesystem_started_at + RUNNING_CONTAINER_FILESYSTEM_SAVE_TIMEOUT_SECONDS))
  running_container_archive_save_bounded container "$running_id" "$running_filesystem_save_first" "$running_filesystem_save_fifo" "$running_filesystem_save_status" "$running_filesystem_deadline" || { running_cleanup; return 2; }
  running_filesystem_sha=$(sha "$running_filesystem_save_first") || { running_cleanup; return 2; }
  running_filesystem_second_sha=$(running_container_archive_hash_stream container "$running_id" "$running_filesystem_hash" "$running_filesystem_hash_fifo" "$running_filesystem_hash_status" "$running_filesystem_deadline") || { running_cleanup; return 2; }
  [ "$running_filesystem_sha" = "$running_filesystem_second_sha" ] || { running_cleanup; return 2; }
  if consumer_matches "$running_filesystem_save_first"; then running_filesystem_match=1; else running_match_status=$?; [ "$running_match_status" -eq 1 ] || { running_cleanup; return 2; }; running_filesystem_match=0; fi
  running_name_recheck=$(temp_path); running_name_recheck_again=$(temp_path)
  running_state_recheck=$(temp_path); running_state_recheck_again=$(temp_path)
  running_image_recheck=$(temp_path); running_image_recheck_again=$(temp_path)
  running_container_pair "$running_id" '{{.Name}}' "$running_name_recheck" "$running_name_recheck_again" || { rm -f "$running_name_recheck" "$running_name_recheck_again" "$running_state_recheck" "$running_state_recheck_again" "$running_image_recheck" "$running_image_recheck_again"; running_cleanup; return 2; }
  running_container_pair "$running_id" '{{json .State.Running}}' "$running_state_recheck" "$running_state_recheck_again" || { rm -f "$running_name_recheck" "$running_name_recheck_again" "$running_state_recheck" "$running_state_recheck_again" "$running_image_recheck" "$running_image_recheck_again"; running_cleanup; return 2; }
  running_container_pair "$running_id" '{{.Image}}' "$running_image_recheck" "$running_image_recheck_again" || { rm -f "$running_name_recheck" "$running_name_recheck_again" "$running_state_recheck" "$running_state_recheck_again" "$running_image_recheck" "$running_image_recheck_again"; running_cleanup; return 2; }
  [ "$(cat "$running_name_recheck")" = "$running_name" ] && [ "$(cat "$running_state_recheck")" = true ] && [ "$(cat "$running_image_recheck")" = "$running_image_id" ] || { rm -f "$running_name_recheck" "$running_name_recheck_again" "$running_state_recheck" "$running_state_recheck_again" "$running_image_recheck" "$running_image_recheck_again"; running_cleanup; return 2; }
  rm -f "$running_name_recheck" "$running_name_recheck_again" "$running_state_recheck" "$running_state_recheck_again" "$running_image_recheck" "$running_image_recheck_again"
  if [ "$running_image_match" -eq 1 ]; then
    running_identity_sha=$(hash_text "$running_id:$running_image_id") || { running_cleanup; return 2; }
    printf 'running-container-image:%s|%s|%s\n' "$running_identity_sha" "$running_configuration_sha" "$running_image_sha"
  fi
  if [ "$running_filesystem_match" -eq 1 ]; then
    running_filesystem_identity_sha=$(hash_text "$running_id:$running_image_id") || { running_cleanup; return 2; }
    printf 'running-container-filesystem:%s|%s|%s\n' "$running_filesystem_identity_sha" "$running_configuration_sha" "$running_filesystem_sha"
  fi
  if grep -Eqi 'ollama|11434' "$running_env_first" "$running_args_first" "$running_health_first" "$running_path_first"; then
    running_metadata_identity_sha=$(hash_text "$running_id:$running_image_id") || { running_cleanup; return 2; }
    printf 'running-container-metadata:%s|%s\n' "$running_metadata_identity_sha" "$running_metadata_sha"
  else
    running_grep_status=$?
    [ "$running_grep_status" -eq 1 ] || { running_cleanup; return 2; }
  fi
  running_cleanup
  return 0
}

container_scan_bindings() {
  scan_id=$1
  scan_name=$2
  scan_line=$3
  scan_state=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .State.Running}}' "$scan_id") || return 2
  case "$scan_state" in
    true) scan_bound=$(container_bind_mount_consumers "$scan_id" && running_container_validate "$scan_id" "$scan_name" "$scan_line") || return 2 ;;
    false) scan_bound=$(container_bind_mount_consumers "$scan_id" && container_argument_consumers "$scan_id" "$scan_line" && container_option_argument_consumers "$scan_id" "$scan_line" && container_environment_consumers "$scan_id" "$scan_line" && container_healthcheck_consumers "$scan_id" "$scan_line") || return 2 ;;
    *) return 2 ;;
  esac
  scan_configuration_after=$(container_configuration "$scan_id") || return 2
  scan_configuration_again=$(container_configuration "$scan_id") || return 2
  [ "$scan_configuration_after" = "$scan_configuration_again" ] && [ "$scan_configuration_after" = "$scan_line" ] || return 2
  final_scan_name=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{.Name}}' "$scan_id") || return 2
  [ "$final_scan_name" = "$scan_name" ] || return 2
  final_scan_state=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .State.Running}}' "$scan_id") || return 2
  final_scan_state_again=$(docker --host "unix://$CANONICAL_DOCKER_SOCKET" inspect -f '{{json .State.Running}}' "$scan_id") || return 2
  [ "$final_scan_state" = "$scan_state" ] && [ "$final_scan_state_again" = "$scan_state" ] || return 2
  if [ "$scan_state" = true ]; then
    [ -z "$scan_bound" ] || printf '%s\n' "$scan_bound"
    if printf '%s' "$scan_line" | /usr/bin/grep -Eqi 'ollama|11434'; then
      scan_line_sha=$(hash_text "$scan_line") || return 2
      printf 'running-container-configuration:%s\n' "$scan_line_sha"
    else
      scan_match_status=$?
      [ "$scan_match_status" -eq 1 ] || return 2
    fi
  else
    [ -z "$scan_bound" ] || printf '%s\n' "$scan_bound"
    if printf '%s' "$scan_line" | /usr/bin/grep -Eqi 'ollama|11434'; then
      printf '%s\n' "$scan_line"
    else
      scan_match_status=$?
      [ "$scan_match_status" -eq 1 ] || return 2
    fi
  fi
}
