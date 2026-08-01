#!/bin/sh
# Crash-safe, source-bound publication for the read-only recovery receipt pair.

recovery_fixed_receipt_dir() {
  printf '%s/%s\n' "$(recovery_receipt_base)" "$RECOVERY_SOURCE_SHA"
}

recovery_receipt_base() {
  if [ "$(id -u)" -ne 0 ] && [ -n "${RETIRE_OLLAMA_RECOVERY_TEST_ROOT:-}" ] && [ -n "${RETIRE_OLLAMA_TEST_BIN:-}" ]; then
    printf '%s\n' "$RETIRE_OLLAMA_RECOVERY_TEST_ROOT"
  else
    printf '%s\n' "$RECOVERY_RECEIPT_ROOT"
  fi
}

recovery_json_digest() {
  candidate=$1; recovery_safe_receipt_file "$candidate" || return 1; canonical=$(temp_path)
  /usr/bin/jq -S -c . "$candidate" >"$canonical" || { /bin/rm -f -- "$canonical"; return 1; }
  /usr/bin/cmp -s "$candidate" "$canonical" || { /bin/rm -f -- "$canonical"; return 1; }
  digest=$(sha "$canonical"); /bin/rm -f -- "$canonical"; printf '%s\n' "$digest"
}

recovery_validate_json() {
  candidate=$1; recovery_safe_receipt_file "$candidate" || return 1
  script_sha=${RECOVERY_SCRIPT_SHA:-$(sha "$SCRIPT_DIR/retire-ollama.sh")}
  helper_sha=${RECOVERY_HELPER_SHA:-$(sha "$RECOVERY_HELPER")}
  receipts_sha=${RECOVERY_RECEIPTS_SHA:-$(sha "$RECOVERY_RECEIPTS_HELPER")}
  /usr/bin/jq -e --arg source "$RECOVERY_SOURCE_SHA" --arg script "$script_sha" --arg helper "$helper_sha" --arg receipts "$receipts_sha" '
    type == "object" and .schemaVersion == 2 and .mode == "recovery-scan" and
    .destructiveAuthority == false and
    (.inventoryBinding | type == "object" and .requiresSeparateReview == true) and
    (.sourceBinding | type == "object" and .sourceSha == $source and
      .scriptSha256 == $script and .helperSha256 == $helper and .receiptsSha256 == $receipts) and
    (.scan | type == "object")
  ' "$candidate" >/dev/null
}

recovery_read_digest() {
  candidate=$1; recovery_safe_receipt_file "$candidate" || return 1
  value=$(cat "$candidate") || return 1
  case "$value" in ''|*[!0-9a-f]*) return 1;; esac
  [ "${#value}" -eq 64 ] || return 1
  printf '%s\n' "$value"
}

recovery_pair_digest() {
  pair_json=$1; pair_digest=$2
  recovery_safe_receipt_file "$pair_json" || return 1; recovery_safe_receipt_file "$pair_digest" || return 1
  recovery_validate_json "$pair_json" || return 1
  pair_digest_value=$(recovery_read_digest "$pair_digest") || return 1
  [ "$pair_digest_value" = "$(recovery_json_digest "$pair_json")" ]
}

recovery_publish_link() {
  pending=$1; target=$2
  recovery_safe_receipt_file "$pending" || return 1
  [ ! -e "$target" ] && [ ! -L "$target" ] || return 1
  ln -- "$pending" "$target" || return 1
  recovery_safe_receipt_ancestry "${target%/*}" || return 1
  recovery_safe_receipt_file "$target" || return 1
  fsync_file "$target"; fsync_dir "${target%/*}"; /bin/rm -f -- "$pending"; fsync_dir "${target%/*}"
}

recovery_safe_receipt_file() {
  file=$1; [ -f "$file" ] && [ ! -L "$file" ] || return 1; [ "$(stat -c '%a' "$file")" = 600 ] || return 1
  if [ "$(id -u)" -eq 0 ]; then [ "$(stat -c '%u:%g' "$file")" = 0:0 ] || return 1; fi
}

recovery_safe_receipt_ancestry() {
  generation=$1; root_directory=${generation%/*}; root_parent=${root_directory%/*}
  [ "$root_directory" = "$(recovery_receipt_base)" ] || return 1
  [ -d "$root_parent" ] && [ ! -L "$root_parent" ] && [ "$(readlink -f -- "$root_parent")" = "$root_parent" ] || return 1
  [ -d "$root_directory" ] && [ ! -L "$root_directory" ] && [ "$(readlink -f -- "$root_directory")" = "$root_directory" ] || return 1
  recovery_safe_receipt_parent "$root_parent" && recovery_safe_dir "$root_directory" && recovery_safe_dir "$generation"
}

recovery_safe_dir() {
  directory=$1; [ -d "$directory" ] && [ ! -L "$directory" ] || return 1
  [ "$(stat -c '%a' "$directory")" = 700 ] || return 1
  if [ "$(id -u)" -eq 0 ]; then [ "$(stat -c '%u:%g' "$directory")" = 0:0 ] || return 1; fi
}

recovery_safe_receipt_parent() {
  directory=$1; [ -d "$directory" ] && [ ! -L "$directory" ] || return 1
  [ "$(readlink -f -- "$directory")" = "$directory" ] || return 1
  mode=$(stat -c '%a' "$directory") || return 1
  case "$mode" in ''|*[!0-7]*) return 1;; esac
  [ $((0$mode & 022)) -eq 0 ] || return 1
  if [ "$(id -u)" -eq 0 ]; then [ "$(stat -c '%u:%g' "$directory")" = 0:0 ] || return 1; fi
}

recovery_prepare_one_dir() {
  directory=$1; parent=$2
  if [ -e "$directory" ] || [ -L "$directory" ]; then recovery_safe_dir "$directory" || die 'unsafe recovery receipt directory'; return; fi
  [ -d "$parent" ] && [ ! -L "$parent" ] || die 'unsafe recovery receipt parent'
  mkdir "$directory" || die 'recovery receipt directory failed'; chmod 0700 "$directory" || die 'recovery receipt directory mode failed'; fsync_dir "$parent"
  recovery_safe_dir "$directory" || die 'unsafe recovery receipt directory'
}

recovery_prepare_dir() {
  target=$1; root_directory=${target%/*}; root_parent=${root_directory%/*}; expected_root=$(recovery_receipt_base)
  [ "$root_directory" = "$expected_root" ] || die 'recovery receipt root mismatch'
  [ -n "$root_directory" ] && [ "$root_directory" != "$target" ] || die 'invalid recovery receipt directory'
  [ -d "$root_parent" ] && [ ! -L "$root_parent" ] && [ "$(readlink -f -- "$root_parent")" = "$root_parent" ] || die 'unsafe recovery receipt parent'
  recovery_safe_receipt_parent "$root_parent" || die 'unsafe recovery receipt parent'
  recovery_prepare_one_dir "$root_directory" "$root_parent"; recovery_prepare_one_dir "$target" "$root_directory"; recovery_safe_receipt_ancestry "$target" || die 'recovery receipt ancestry changed'
}

recovery_make_digest_file() {
  source=$1; target=$2; [ ! -e "$target" ] && [ ! -L "$target" ] || return 1
  value=$(recovery_json_digest "$source") || return 1
  temporary=$(temp_path); printf '%s\n' "$value" >"$temporary"; chmod 0600 "$temporary"; fsync_file "$temporary"
  recovery_publish_link "$temporary" "$target" || { /bin/rm -f -- "$temporary"; return 1; }
}

recovery_no_pending() {
  directory=$1; for pending in "$directory"/*.pending; do [ -e "$pending" ] || [ -L "$pending" ] || continue; return 1; done; return 0
}

recovery_reconcile_pair() {
  directory=$1; json="$directory/recovery-scan.json"; digest="$json.sha256"; json_pending="$json.pending"; digest_pending="$digest.pending"
  json_exists=0; digest_exists=0; json_pending_exists=0; digest_pending_exists=0
  [ -e "$json" ] || [ -L "$json" ] && json_exists=1; [ -e "$digest" ] || [ -L "$digest" ] && digest_exists=1
  [ -e "$json_pending" ] || [ -L "$json_pending" ] && json_pending_exists=1; [ -e "$digest_pending" ] || [ -L "$digest_pending" ] && digest_pending_exists=1
  if [ "$json_exists" -eq 1 ]; then
    [ -f "$json" ] && [ ! -L "$json" ] || review_required 'recovery receipt JSON unsafe'
    recovery_validate_json "$json" || review_required 'recovery receipt JSON unsafe'
  fi
  if [ "$digest_exists" -eq 1 ]; then
    [ -f "$digest" ] && [ ! -L "$digest" ] || review_required 'recovery receipt digest unsafe'
    recovery_read_digest "$digest" >/dev/null || review_required 'recovery receipt digest unsafe'
  fi
  if [ "$json_exists" -eq 1 ] && [ "$digest_exists" -eq 1 ]; then
    recovery_pair_digest "$json" "$digest" || review_required 'recovery receipt pair drift'
    if [ "$json_pending_exists" -eq 1 ]; then recovery_pair_digest "$json_pending" "$digest_pending" || { recovery_validate_json "$json_pending" || review_required 'recovery pending JSON unsafe'; [ "$(recovery_json_digest "$json_pending")" = "$(recovery_read_digest "$digest")" ] || review_required 'recovery pending JSON drift'; }; /bin/rm -f -- "$json_pending"; fi
    if [ "$digest_pending_exists" -eq 1 ]; then [ "$(recovery_read_digest "$digest_pending")" = "$(recovery_read_digest "$digest")" ] || review_required 'recovery pending digest drift'; /bin/rm -f -- "$digest_pending"; fi
    recovery_no_pending "$directory" || review_required 'recovery receipt pending residue'; return 0
  fi
  if [ "$json_exists" -eq 1 ]; then
    if [ "$digest_pending_exists" -eq 1 ]; then [ "$(recovery_read_digest "$digest_pending")" = "$(recovery_json_digest "$json")" ] || review_required 'recovery digest pending drift'; recovery_publish_link "$digest_pending" "$digest" || review_required 'recovery digest publication race'; else recovery_make_digest_file "$json" "$digest" || review_required 'recovery digest publication failed'; fi
    recovery_pair_digest "$json" "$digest" || review_required 'recovery receipt pair drift'; recovery_no_pending "$directory" || review_required 'recovery receipt pending residue'; return 0
  fi
  if [ "$digest_exists" -eq 1 ]; then
    [ "$json_pending_exists" -eq 1 ] || review_required 'recovery receipt JSON missing'
    recovery_validate_json "$json_pending" || review_required 'recovery JSON pending unsafe'; [ "$(recovery_json_digest "$json_pending")" = "$(recovery_read_digest "$digest")" ] || review_required 'recovery JSON pending drift'
    recovery_publish_link "$json_pending" "$json" || review_required 'recovery JSON publication race'; recovery_pair_digest "$json" "$digest" || review_required 'recovery receipt pair drift'; recovery_no_pending "$directory" || review_required 'recovery receipt pending residue'; return 0
  fi
  if [ "$json_pending_exists" -eq 0 ]; then [ "$digest_pending_exists" -eq 0 ] && return 1; review_required 'recovery receipt JSON pending missing'; fi
  recovery_validate_json "$json_pending" || review_required 'recovery JSON pending unsafe'
  if [ "$digest_pending_exists" -eq 0 ]; then recovery_make_digest_file "$json_pending" "$digest_pending" || review_required 'recovery digest pending failed'; fi
  recovery_pair_digest "$json_pending" "$digest_pending" || review_required 'recovery pending receipt pair drift'
  recovery_publish_link "$json_pending" "$json" || review_required 'recovery JSON publication race'; recovery_publish_link "$digest_pending" "$digest" || review_required 'recovery digest publication race'
  recovery_pair_digest "$json" "$digest" || review_required 'recovery receipt pair drift'; recovery_no_pending "$directory" || review_required 'recovery receipt pending residue'; return 0
}

recovery_write_receipt() {
  snapshot=$1; directory=$(recovery_fixed_receipt_dir); recovery_prepare_dir "$directory"
  if recovery_reconcile_pair "$directory"; then
    current=$(temp_path); /usr/bin/jq -S -c . "$snapshot" >"$current" || die 'recovery snapshot invalid'
    stored=$(temp_path); /usr/bin/jq -S -c .scan "$directory/recovery-scan.json" >"$stored" || die 'recovery stored scan invalid'
    /usr/bin/cmp -s "$current" "$stored" || { /bin/rm -f -- "$current" "$stored"; review_required 'recovery receipt snapshot drift'; }
    /bin/rm -f -- "$current" "$stored"; cat "$directory/recovery-scan.json.sha256"; return 0
  fi
  RECOVERY_SCRIPT_SHA=${RECOVERY_SCRIPT_SHA:-$(sha "$SCRIPT_DIR/retire-ollama.sh")}; RECOVERY_HELPER_SHA=${RECOVERY_HELPER_SHA:-$(sha "$RECOVERY_HELPER")}; RECOVERY_RECEIPTS_SHA=${RECOVERY_RECEIPTS_SHA:-$(sha "$RECOVERY_RECEIPTS_HELPER")}
  json="$directory/recovery-scan.json"; digest="$json.sha256"; json_pending="$json.pending"; digest_pending="$digest.pending"
  [ ! -e "$json" ] && [ ! -L "$json" ] && [ ! -e "$digest" ] && [ ! -L "$digest" ] && [ ! -e "$json_pending" ] && [ ! -L "$json_pending" ] && [ ! -e "$digest_pending" ] && [ ! -L "$digest_pending" ] || review_required 'recovery receipt publication race'
  pending=$(temp_path); /usr/bin/jq -S -c -n --slurpfile scan "$snapshot" --arg source "$RECOVERY_SOURCE_SHA" --arg script "$RECOVERY_SCRIPT_SHA" --arg helper "$RECOVERY_HELPER_SHA" --arg receipts "$RECOVERY_RECEIPTS_SHA" '{schemaVersion:2,mode:"recovery-scan",destructiveAuthority:false,inventoryBinding:{requiresSeparateReview:true},sourceBinding:{sourceSha:$source,scriptSha256:$script,helperSha256:$helper,receiptsSha256:$receipts},scan:$scan[0]}' >"$pending" || { /bin/rm -f -- "$pending"; die 'recovery receipt serialization failed'; }
  chmod 0600 "$pending"; fsync_file "$pending"; ln -- "$pending" "$json_pending" || { /bin/rm -f -- "$pending"; review_required 'recovery receipt JSON pending race'; }; /bin/rm -f -- "$pending"; fsync_dir "$directory"
  recovery_make_digest_file "$json_pending" "$digest_pending" || review_required 'recovery receipt digest pending race'; recovery_reconcile_pair "$directory" || review_required 'recovery receipt publication failed'; cat "$directory/recovery-scan.json.sha256"
}
