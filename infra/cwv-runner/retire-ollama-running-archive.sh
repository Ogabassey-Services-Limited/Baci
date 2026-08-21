#!/bin/sh
RUNNING_CONTAINER_IMAGE_MAX_BYTES=1073741824
RUNNING_CONTAINER_FILESYSTEM_MAX_BYTES=4294967296
# shellcheck disable=SC2034 # Consumed by the running-container helper after sourcing.
RUNNING_CONTAINER_IMAGE_SAVE_TIMEOUT_SECONDS=120
# shellcheck disable=SC2034 # Consumed by the running-container helper after sourcing.
RUNNING_CONTAINER_FILESYSTEM_SAVE_TIMEOUT_SECONDS=300

running_container_now() { /bin/date +%s; }

running_container_kill_pids() {
  for running_kill_pid do kill -TERM "$running_kill_pid" 2>/dev/null || :; done
  sleep 1
  for running_kill_pid do kill -0 "$running_kill_pid" 2>/dev/null && kill -KILL "$running_kill_pid" 2>/dev/null || :; done
}

running_container_wait_group() {
  running_group_deadline=$1
  shift
  running_group_pids=''; running_group_files=''; running_group_mode=pids
  for running_group_arg do
    if [ "$running_group_arg" = -- ]; then running_group_mode=files; continue; fi
    if [ "$running_group_mode" = pids ]; then running_group_pids="$running_group_pids $running_group_arg"; else running_group_files="$running_group_files $running_group_arg"; fi
  done
  while :; do
    running_group_now=$(running_container_now) || {
      # shellcheck disable=SC2086 # The validated internal value is a PID list.
      running_container_kill_pids $running_group_pids
      for running_group_pid in $running_group_pids; do wait "$running_group_pid" 2>/dev/null || :; done
      return 124
    }
    if [ "$running_group_now" -ge "$running_group_deadline" ]; then
      # shellcheck disable=SC2086 # The validated internal value is a PID list.
      running_container_kill_pids $running_group_pids
      for running_group_pid in $running_group_pids; do wait "$running_group_pid" 2>/dev/null || :; done
      return 124
    fi
    running_group_complete=1
    for running_group_file in $running_group_files; do [ -s "$running_group_file" ] || running_group_complete=0; done
    if [ "$running_group_complete" -eq 1 ]; then
      running_group_running=0
      for running_group_pid in $running_group_pids; do kill -0 "$running_group_pid" 2>/dev/null && running_group_running=1; done
      if [ "$running_group_running" -eq 0 ]; then
        running_group_status=0
        for running_group_pid in $running_group_pids; do wait "$running_group_pid" 2>/dev/null || running_group_status=$?; done
        [ "$running_group_status" -eq 0 ] && return 0
        return "$running_group_status"
      fi
    fi
    sleep 1
  done
}

running_container_archive_command() {
  case "$1" in
    image) docker --host "unix://$CANONICAL_DOCKER_SOCKET" image save "$2" ;;
    container) docker --host "unix://$CANONICAL_DOCKER_SOCKET" container export "$2" ;;
    *) return 2 ;;
  esac
}

running_container_archive_limit() {
  case "$1" in
    image) printf '%s\n' "$RUNNING_CONTAINER_IMAGE_MAX_BYTES" ;;
    container) printf '%s\n' "$RUNNING_CONTAINER_FILESYSTEM_MAX_BYTES" ;;
    *) return 2 ;;
  esac
}

running_container_archive_save_bounded() {
  running_save_kind=$1; running_save_id=$2; running_save_output=$3; running_save_fifo=$4; running_save_status=$5; running_save_deadline=$6
  running_save_limit=$(running_container_archive_limit "$running_save_kind") || return 2
  rm -f "$running_save_output" "$running_save_fifo" "$running_save_status"
  mkfifo "$running_save_fifo" || return 2
  : >"$running_save_status" || { rm -f "$running_save_fifo"; return 2; }
  running_container_archive_command "$running_save_kind" "$running_save_id" >"$running_save_fifo" 2>/dev/null &
  running_save_pid=$!
  /usr/bin/perl -e '
    my ($output, $status, $limit) = @ARGV; binmode STDIN; open my $fh, ">", $output or exit 2; binmode $fh;
    my ($total, $ok) = (0, 1); while (read(STDIN, my $chunk, 65536)) { $total += length($chunk); if ($total > $limit) { $ok = 0; last; } print {$fh} $chunk or $ok = 0; last unless $ok; }
    close $fh; open my $sf, ">", $status or exit 2; print {$sf} ($ok ? "0\n" : "2\n"); close $sf; exit($ok ? 0 : 2);
  ' "$running_save_output" "$running_save_status" "$running_save_limit" <"$running_save_fifo" &
  running_save_reader_pid=$!
  running_container_wait_group "$running_save_deadline" "$running_save_reader_pid" "$running_save_pid" -- "$running_save_status"; running_save_group_status=$?
  rm -f "$running_save_fifo"
  [ "$running_save_group_status" -eq 0 ] && [ "$(cat "$running_save_status" 2>/dev/null)" = 0 ] && [ -s "$running_save_output" ] || return 2
}

running_container_archive_hash_stream() {
  running_hash_kind=$1; running_hash_id=$2; running_hash_output=$3; running_hash_fifo=$4; running_hash_status_file=$5; running_hash_deadline=$6
  running_hash_limit=$(running_container_archive_limit "$running_hash_kind") || return 2
  running_hash_digest_fifo=$(temp_path)
  rm -f "$running_hash_fifo" "$running_hash_digest_fifo" "$running_hash_output" "$running_hash_status_file"
  mkfifo "$running_hash_fifo" "$running_hash_digest_fifo" || return 2
  : >"$running_hash_status_file" || { rm -f "$running_hash_fifo" "$running_hash_digest_fifo"; return 2; }
  running_container_archive_command "$running_hash_kind" "$running_hash_id" >"$running_hash_fifo" 2>/dev/null &
  running_hash_pid=$!
  sha256sum "$running_hash_digest_fifo" >"$running_hash_output" 2>/dev/null &
  running_hash_sum_pid=$!
  /usr/bin/perl -e '
    my ($status, $limit) = @ARGV; binmode STDIN; my ($total, $ok) = (0, 1);
    while (read(STDIN, my $chunk, 65536)) { $total += length($chunk); if ($total > $limit) { $ok = 0; last; } print $chunk or $ok = 0; last unless $ok; }
    open my $sf, ">", $status or exit 2; print {$sf} ($ok ? "0\n" : "2\n"); close $sf; exit($ok ? 0 : 2);
  ' "$running_hash_status_file" "$running_hash_limit" <"$running_hash_fifo" >"$running_hash_digest_fifo" 2>/dev/null &
  running_hash_reader_pid=$!
  running_container_wait_group "$running_hash_deadline" "$running_hash_reader_pid" "$running_hash_sum_pid" "$running_hash_pid" -- "$running_hash_status_file" "$running_hash_output"; running_hash_group_status=$?
  rm -f "$running_hash_fifo" "$running_hash_digest_fifo"
  [ "$running_hash_group_status" -eq 0 ] && [ "$(cat "$running_hash_status_file" 2>/dev/null)" = 0 ] || return 2
  IFS=' ' read -r running_hash_value _ <"$running_hash_output" || return 2
  printf '%s\n' "$running_hash_value" | grep -Eq '^[0-9a-f]{64}$' || return 2
  printf '%s\n' "$running_hash_value"
}
