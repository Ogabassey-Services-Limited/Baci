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

recovery_drift_snapshot() {
  source=$1; target=$2
  /usr/bin/jq -S '
    if (.processes | type) == "object" then .processes = (.processes | del(.scannerAncestors)) else . end |
    .surfaces = ((.surfaces // []) | map(select(.class != "running-processes"))) |
    .dependencies = ((.dependencies // []) | map(select((.["key-name"] // "") | startswith("running-processes:") | not))) |
    .consumerCounts = ((.consumerCounts // []) | map(select(.surface != "running-processes"))) |
    .consumerEvidence = ((.consumerEvidence // []) | map(select(.surface != "running-processes")))
  ' "$source" >"$target"
}

recovery_source_digests() {
  actual_script=$(sha "$SCRIPT_DIR/retire-ollama.sh") || return 1
  actual_helper=$(sha "$RECOVERY_HELPER") || return 1
  actual_receipts=$(sha "$RECOVERY_RECEIPTS_HELPER") || return 1
  actual_consumers=$(sha "$RECOVERY_CONSUMERS_HELPER") || return 1
  actual_consumer_closure=$(sha "$RECOVERY_CONSUMER_CLOSURE_HELPER") || return 1
  actual_process_files=$(sha "$RECOVERY_PROCESS_FILES_HELPER") || return 1
  actual_cron_inventory=$(sha "$SCRIPT_DIR/retire-ollama-cron-inventory.sh") || return 1
  actual_at_quiescence=$(sha "$SCRIPT_DIR/retire-ollama-at-quiescence.sh") || return 1
  if [ "$(id -u)" -ne 0 ] && [ -n "${RETIRE_OLLAMA_TEST_BIN:-}" ]; then
    RECOVERY_SCRIPT_SHA=${RECOVERY_SCRIPT_SHA:-$actual_script}; RECOVERY_HELPER_SHA=${RECOVERY_HELPER_SHA:-$actual_helper}; RECOVERY_RECEIPTS_SHA=${RECOVERY_RECEIPTS_SHA:-$actual_receipts}; RECOVERY_CONSUMERS_SHA=${RECOVERY_CONSUMERS_SHA:-$actual_consumers}; RECOVERY_CONSUMER_CLOSURE_SHA=${RECOVERY_CONSUMER_CLOSURE_SHA:-$actual_consumer_closure}; RECOVERY_PROCESS_FILES_SHA=${RECOVERY_PROCESS_FILES_SHA:-$actual_process_files}; RECOVERY_CRON_INVENTORY_SHA=${RECOVERY_CRON_INVENTORY_SHA:-$actual_cron_inventory}; RECOVERY_AT_QUIESCENCE_SHA=${RECOVERY_AT_QUIESCENCE_SHA:-$actual_at_quiescence}
  else
    RECOVERY_SCRIPT_SHA=$actual_script; RECOVERY_HELPER_SHA=$actual_helper; RECOVERY_RECEIPTS_SHA=$actual_receipts; RECOVERY_CONSUMERS_SHA=$actual_consumers; RECOVERY_CONSUMER_CLOSURE_SHA=$actual_consumer_closure; RECOVERY_PROCESS_FILES_SHA=$actual_process_files; RECOVERY_CRON_INVENTORY_SHA=$actual_cron_inventory; RECOVERY_AT_QUIESCENCE_SHA=$actual_at_quiescence
  fi
}

recovery_validate_json() {
  candidate=$1; recovery_safe_receipt_file "$candidate" || return 1
  recovery_source_digests || return 1
  /usr/bin/jq -e --arg source "$RECOVERY_SOURCE_SHA" --arg script "$RECOVERY_SCRIPT_SHA" --arg helper "$RECOVERY_HELPER_SHA" --arg receipts "$RECOVERY_RECEIPTS_SHA" --arg consumers "$RECOVERY_CONSUMERS_SHA" --arg consumer_closure "$RECOVERY_CONSUMER_CLOSURE_SHA" --arg process_files "$RECOVERY_PROCESS_FILES_SHA" --arg cron_inventory "$RECOVERY_CRON_INVENTORY_SHA" --arg at_quiescence "$RECOVERY_AT_QUIESCENCE_SHA" '
    type == "object" and .schemaVersion == 2 and .mode == "recovery-scan" and
    .destructiveAuthority == false and
    (.inventoryBinding | type == "object" and .requiresSeparateReview == true) and
    (.sourceBinding | type == "object" and .sourceSha == $source and
      .scriptSha256 == $script and .helperSha256 == $helper and .receiptsSha256 == $receipts and .consumersSha256 == $consumers and .consumerClosureSha256 == $consumer_closure and .processFilesSha256 == $process_files and .cronInventorySha256 == $cron_inventory and .atQuiescenceSha256 == $at_quiescence) and
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
  pair_json_value=$(recovery_json_digest "$pair_json") || return 1
  [ -n "$pair_digest_value" ] && [ -n "$pair_json_value" ] && [ "$pair_digest_value" = "$pair_json_value" ]
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

recovery_reconcile_duplicate_link() {
  pending=$1; target=$2
  recovery_safe_receipt_file "$pending" || return 1
  recovery_safe_receipt_file "$target" || return 1
  pending_identity=$(stat -c '%d:%i' "$pending") || return 1; target_identity=$(stat -c '%d:%i' "$target") || return 1
  [ -n "$pending_identity" ] && [ -n "$target_identity" ] && [ "$pending_identity" = "$target_identity" ] || return 1
  pending_digest=$(recovery_json_digest "$pending") || return 1; target_digest=$(recovery_json_digest "$target") || return 1
  [ -n "$pending_digest" ] && [ -n "$target_digest" ] && [ "$pending_digest" = "$target_digest" ] || return 1
  /bin/rm -f -- "$pending"; fsync_dir "${target%/*}"
}

recovery_reconcile_digest_link() {
  pending=$1; target=$2
  recovery_safe_receipt_file "$pending" || return 1
  recovery_safe_receipt_file "$target" || return 1
  pending_identity=$(stat -c '%d:%i' "$pending") || return 1; target_identity=$(stat -c '%d:%i' "$target") || return 1
  [ -n "$pending_identity" ] && [ -n "$target_identity" ] && [ "$pending_identity" = "$target_identity" ] || return 1
  pending_digest=$(recovery_read_digest "$pending") || return 1; target_digest=$(recovery_read_digest "$target") || return 1
  [ -n "$pending_digest" ] && [ -n "$target_digest" ] && [ "$pending_digest" = "$target_digest" ] || return 1
  /bin/rm -f -- "$pending"; fsync_dir "${target%/*}"
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

recovery_receipt_temp_path() {
  directory=$1; recovery_safe_receipt_ancestry "$directory" || return 1
  temporary=$(mktemp "$directory/.recovery-publish.XXXXXX") || return 1
  chmod 0600 "$temporary" || { /bin/rm -f -- "$temporary"; return 1; }
  recovery_safe_receipt_file "$temporary" || { /bin/rm -f -- "$temporary"; return 1; }
  printf '%s\n' "$temporary"
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
  temporary=$(recovery_receipt_temp_path "${target%/*}") || return 1; printf '%s\n' "$value" >"$temporary"; fsync_file "$temporary"
  recovery_publish_link "$temporary" "$target" || { /bin/rm -f -- "$temporary"; return 1; }
}

recovery_no_pending() {
  directory=$1; for pending in "$directory"/*.pending; do [ -e "$pending" ] || [ -L "$pending" ] || continue; return 1; done; return 0
}

recovery_reconcile_publish_temporaries() {
  directory=$1; json="$directory/recovery-scan.json"; digest="$json.sha256"
  for temporary in "$directory"/.recovery-publish.*; do
    [ -e "$temporary" ] || [ -L "$temporary" ] || continue
    recovery_safe_receipt_file "$temporary" || return 1
    temporary_identity=$(stat -c '%d:%i' "$temporary") || return 1
    [ -n "$temporary_identity" ] || return 1
    if [ -e "$json" ]; then json_identity=$(stat -c '%d:%i' "$json") || return 1; [ -n "$json_identity" ] || return 1; if [ "$temporary_identity" = "$json_identity" ]; then recovery_reconcile_duplicate_link "$temporary" "$json" || return 1; continue; fi; fi
    if [ -e "$digest" ]; then digest_identity=$(stat -c '%d:%i' "$digest") || return 1; [ -n "$digest_identity" ] || return 1; if [ "$temporary_identity" = "$digest_identity" ]; then recovery_reconcile_digest_link "$temporary" "$digest" || return 1; continue; fi; fi
    /bin/rm -f -- "$temporary" || return 1; fsync_dir "$directory"
  done
}

recovery_reconcile_pair() {
  directory=$1; json="$directory/recovery-scan.json"; digest="$json.sha256"; json_pending="$json.pending"; digest_pending="$digest.pending"
  recovery_reconcile_publish_temporaries "$directory" || review_required 'recovery publication temporary residue'
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
    if [ "$json_pending_exists" -eq 1 ]; then if [ "$digest_pending_exists" -eq 1 ]; then recovery_pair_digest "$json_pending" "$digest_pending" || review_required 'recovery pending JSON pair drift'; fi; recovery_reconcile_duplicate_link "$json_pending" "$json" || review_required 'recovery pending JSON residue'; fi
    if [ "$digest_pending_exists" -eq 1 ]; then pending_digest=$(recovery_read_digest "$digest_pending") || review_required 'recovery pending digest drift'; digest_value=$(recovery_read_digest "$digest") || review_required 'recovery pending digest drift'; [ -n "$pending_digest" ] && [ -n "$digest_value" ] && [ "$pending_digest" = "$digest_value" ] || review_required 'recovery pending digest drift'; /bin/rm -f -- "$digest_pending" || review_required 'recovery pending digest cleanup failed'; fsync_dir "$directory"; fi
    recovery_no_pending "$directory" || review_required 'recovery receipt pending residue'; return 0
  fi
  if [ "$json_exists" -eq 1 ]; then
    if [ "$digest_pending_exists" -eq 1 ]; then pending_digest=$(recovery_read_digest "$digest_pending") || review_required 'recovery digest pending drift'; json_digest=$(recovery_json_digest "$json") || review_required 'recovery digest pending drift'; [ -n "$pending_digest" ] && [ -n "$json_digest" ] && [ "$pending_digest" = "$json_digest" ] || review_required 'recovery digest pending drift'; recovery_publish_link "$digest_pending" "$digest" || review_required 'recovery digest publication race'; else recovery_make_digest_file "$json" "$digest" || review_required 'recovery digest publication failed'; fi
    if [ "$json_pending_exists" -eq 1 ]; then recovery_reconcile_duplicate_link "$json_pending" "$json" || review_required 'recovery pending JSON residue'; fi
    recovery_pair_digest "$json" "$digest" || review_required 'recovery receipt pair drift'; recovery_no_pending "$directory" || review_required 'recovery receipt pending residue'; return 0
  fi
  if [ "$digest_exists" -eq 1 ]; then
    [ "$json_pending_exists" -eq 1 ] || review_required 'recovery receipt JSON missing'
    recovery_validate_json "$json_pending" || review_required 'recovery JSON pending unsafe'; pending_json_digest=$(recovery_json_digest "$json_pending") || review_required 'recovery JSON pending drift'; digest_value=$(recovery_read_digest "$digest") || review_required 'recovery JSON pending drift'; [ -n "$pending_json_digest" ] && [ -n "$digest_value" ] && [ "$pending_json_digest" = "$digest_value" ] || review_required 'recovery JSON pending drift'
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
    current=$(temp_path); recovery_drift_snapshot "$snapshot" "$current" || die 'recovery snapshot invalid'
    stored_source=$(temp_path); /usr/bin/jq -S -c .scan "$directory/recovery-scan.json" >"$stored_source" || die 'recovery stored scan invalid'
    stored=$(temp_path); recovery_drift_snapshot "$stored_source" "$stored" || die 'recovery stored scan invalid'
    /usr/bin/cmp -s "$current" "$stored" || { /bin/rm -f -- "$current" "$stored"; review_required 'recovery receipt snapshot drift'; }
    /bin/rm -f -- "$current" "$stored_source" "$stored"; cat "$directory/recovery-scan.json.sha256"; return 0
  fi
  recovery_source_digests || die 'recovery source digest failed'
  json="$directory/recovery-scan.json"; digest="$json.sha256"; json_pending="$json.pending"; digest_pending="$digest.pending"
  [ ! -e "$json" ] && [ ! -L "$json" ] && [ ! -e "$digest" ] && [ ! -L "$digest" ] && [ ! -e "$json_pending" ] && [ ! -L "$json_pending" ] && [ ! -e "$digest_pending" ] && [ ! -L "$digest_pending" ] || review_required 'recovery receipt publication race'
  pending=$(recovery_receipt_temp_path "$directory") || review_required 'recovery receipt temporary failed'; /usr/bin/jq -S -c -n --slurpfile scan "$snapshot" --arg source "$RECOVERY_SOURCE_SHA" --arg script "$RECOVERY_SCRIPT_SHA" --arg helper "$RECOVERY_HELPER_SHA" --arg receipts "$RECOVERY_RECEIPTS_SHA" --arg consumers "$RECOVERY_CONSUMERS_SHA" --arg consumer_closure "$RECOVERY_CONSUMER_CLOSURE_SHA" --arg process_files "$RECOVERY_PROCESS_FILES_SHA" --arg cron_inventory "$RECOVERY_CRON_INVENTORY_SHA" --arg at_quiescence "$RECOVERY_AT_QUIESCENCE_SHA" '{schemaVersion:2,mode:"recovery-scan",destructiveAuthority:false,inventoryBinding:{requiresSeparateReview:true},sourceBinding:{sourceSha:$source,scriptSha256:$script,helperSha256:$helper,receiptsSha256:$receipts,consumersSha256:$consumers,consumerClosureSha256:$consumer_closure,processFilesSha256:$process_files,cronInventorySha256:$cron_inventory,atQuiescenceSha256:$at_quiescence},scan:$scan[0]}' >"$pending" || { /bin/rm -f -- "$pending"; die 'recovery receipt serialization failed'; }
  chmod 0600 "$pending"; fsync_file "$pending"; ln -- "$pending" "$json_pending" || { /bin/rm -f -- "$pending"; review_required 'recovery receipt JSON pending race'; }; /bin/rm -f -- "$pending"; fsync_dir "$directory"
  recovery_make_digest_file "$json_pending" "$digest_pending" || review_required 'recovery receipt digest pending race'; recovery_reconcile_pair "$directory" || review_required 'recovery receipt publication failed'; cat "$directory/recovery-scan.json.sha256"
}
