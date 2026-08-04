#!/bin/sh

at_submission_mount_state() {
  if value=$(/usr/bin/findmnt -rn --vfs-all --mountpoint "$AT_JOB_DIR" -o TARGET,VFS-OPTIONS 2>/dev/null); then
    case "$value" in
      "$AT_JOB_DIR "*) options=${value#"$AT_JOB_DIR "} ;;
      *) die 'at submission mount state invalid' ;;
    esac
    case ",$options," in
      *,ro,*) printf '%s\n' ro ;;
      *,rw,*) printf '%s\n' rw ;;
      *) die 'at submission mount options invalid' ;;
    esac
  else
    status=$?
    [ "$status" -eq 1 ] || die 'at submission mount inspection failed'
    printf '%s\n' absent
  fi
}

at_create_bind_mount() {
  /usr/bin/mount --bind "$AT_JOB_DIR" "$AT_JOB_DIR" ||
    die 'at submission bind mount failed'
}

at_remount_bind_readonly() {
  /usr/bin/mount -o remount,bind,ro "$AT_JOB_DIR" "$AT_JOB_DIR" ||
    die 'at submission read-only remount failed'
}

at_unmount_submission_spool() {
  /usr/bin/umount "$AT_JOB_DIR" || die 'at submission unmount failed'
}

# shellcheck disable=SC2086 # The validated stat record is intentionally split on colon.
at_submission_state() {
  at_dir=$AT_JOB_DIR
  at_sequence=$at_dir/.SEQ
  [ -d "$at_dir" ] && [ ! -L "$at_dir" ] &&
    [ "$(CDPATH='' cd -- "$at_dir" && pwd -P)" = "$at_dir" ] ||
    die 'unsafe at submission spool'
  [ "$(at_submission_mount_state)" = absent ] ||
    die 'at submission spool already mounted'
  [ -f "$at_sequence" ] && [ ! -L "$at_sequence" ] ||
    die 'unsafe at sequence file'
  at_state=$(stat -c '%d:%i:%u:%g:%a' "$at_dir") ||
    die 'at submission spool identity failed'
  at_sequence_state=$(stat -c '%d:%i:%u:%g:%a' "$at_sequence") ||
    die 'at sequence identity failed'
  old_ifs=$IFS
  IFS=:
  set -- $at_state
  IFS=$old_ifs
  [ "$#" -eq 5 ] && [ "$5" = 1770 ] &&
    [ "${at_sequence_state#*:*:}" = "$3:$4:600" ] ||
    die 'at submission spool contract drift'
  jq -cn --arg path "$at_dir" --arg identity "$1:$2:$3:$4" \
    --arg sequenceIdentity "${at_sequence_state%:600}" \
    '{path:$path,identity:$identity,sequenceIdentity:$sequenceIdentity,originalMountState:"absent",quiescedMountState:"ro-bind"}'
}

assert_at_submission_identity() {
  at_expected=$1
  at_path=$(printf '%s\n' "$at_expected" | jq -er '.path') ||
    die 'at rollback state invalid'
  at_identity=$(printf '%s\n' "$at_expected" | jq -er '.identity') ||
    die 'at rollback state invalid'
  at_sequence_identity=$(printf '%s\n' "$at_expected" | jq -er '.sequenceIdentity') ||
    die 'at rollback state invalid'
  [ "$at_path" = "$AT_JOB_DIR" ] &&
    [ "$(stat -c '%d:%i:%u:%g:%a' "$at_path")" = "$at_identity:1770" ] &&
    [ -f "$at_path/.SEQ" ] && [ ! -L "$at_path/.SEQ" ] &&
    [ "$(stat -c '%d:%i:%u:%g:%a' "$at_path/.SEQ")" = "$at_sequence_identity:600" ] ||
    die 'at submission identity drift'
}

assert_at_submissions_quiesced() {
  at_expected=$1
  assert_at_submission_identity "$at_expected"
  [ "$(at_submission_mount_state)" = ro ] ||
    die 'at submission quiescence drift'
  cron_inventory_require_empty_at_queue || die 'queued work or an unsafe queue'
}

quiesce_at_submissions() {
  at_expected=$1
  [ "$(at_submission_state)" = "$at_expected" ] ||
    die 'at submission spool changed'
  at_create_bind_mount
  [ "$(at_submission_mount_state)" = rw ] ||
    die 'at submission bind mount state invalid'
  assert_at_submission_identity "$at_expected"
  at_remount_bind_readonly
  assert_at_submissions_quiesced "$at_expected"
}

reconcile_interrupted_at_quiescence() {
  at_pre="$RECEIPT_DIR/pre-destructive.json"
  at_actions="$RECEIPT_DIR/pre-destructive.actions"
  [ -e "$at_pre" ] || return 0
  safe_file "$at_pre" || die 'unsafe pre-destructive receipt'
  at_expected=$(jq -ce '.atSubmissionRollback | select(.path == $path and .originalMountState == "absent" and .quiescedMountState == "ro-bind" and (.identity | test("^[0-9]+:[0-9]+:[0-9]+:[0-9]+$")) and (.sequenceIdentity | test("^[0-9]+:[0-9]+:[0-9]+:[0-9]+$")))' --arg path "$AT_JOB_DIR" "$at_pre") ||
    die 'at rollback receipt invalid'
  if [ -e "$at_actions" ]; then
    safe_file "$at_actions" &&
      [ "$(cat "$at_actions")" = quiesce_at_submissions ] || return 0
    case "$(at_submission_mount_state)" in
      absent) assert_at_submission_identity "$at_expected" ;;
      rw|ro)
        assert_at_submission_identity "$at_expected"
        at_unmount_submission_spool
        [ "$(at_submission_mount_state)" = absent ] ||
          die 'at rollback unmount drift'
        assert_at_submission_identity "$at_expected"
        ;;
      *) die 'at rollback mount state drift' ;;
    esac
    rm -f "$at_actions" || die 'at rollback action cleanup failed'
    fsync_dir "$RECEIPT_DIR"
  else
    [ "$(at_submission_mount_state)" = absent ] || return 0
    assert_at_submission_identity "$at_expected"
  fi
  rm -f "$at_pre" || die 'at rollback receipt cleanup failed'
  fsync_dir "$RECEIPT_DIR"
}
