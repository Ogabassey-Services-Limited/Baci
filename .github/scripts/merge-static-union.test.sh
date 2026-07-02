#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
SCRIPT="$SCRIPT_DIR/merge-static-union.sh"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

run_merge() {
  # Usage: run_merge <union-dir> <output-dir> [RETENTION_SECONDS] [MAX_UNION_MEGABYTES]
  # Captures combined output so an unexpected failure surfaces the script's
  # diagnostics on stderr instead of set -e aborting silently.
  local union_dir="$1" output_dir="$2"
  local retention="${3:-172800}" max_mb="${4:-512}"
  local status=0 merge_output=""
  set +e
  merge_output=$(RETENTION_SECONDS="$retention" MAX_UNION_MEGABYTES="$max_mb" \
    UNION_DIR="$union_dir" OUTPUT_STATIC_DIR="$output_dir" \
    bash "$SCRIPT" 2>&1)
  status=$?
  set -e
  if [ "$status" -ne 0 ]; then
    printf 'merge-static-union.sh exited %s:\n%s\n' "$status" "$merge_output" >&2
    return "$status"
  fi
  printf '%s' "$merge_output"
}

# --- Test 1: fresh run with empty union ingests all, restores none. ---------
test1_union="$TMPDIR/t1/union"
test1_out="$TMPDIR/t1/out/_next/static/chunks"
mkdir -p "$test1_out"
printf 'content-a\n' > "$test1_out/a-111.js"
printf 'content-b\n' > "$test1_out/b-222.js"

output=$(run_merge "$TMPDIR/t1/union" "$TMPDIR/t1/out/_next/static" 2>&1)
printf '%s' "$output" | grep -q 'restored=0 ingested=2 pruned=0 union_total=2' \
  || fail "fresh run should ingest all files and restore none: $output"
[ -f "$test1_union/files/chunks/a-111.js" ] || fail "fresh run should copy a-111.js into the union"
[ -f "$test1_union/files/chunks/b-222.js" ] || fail "fresh run should copy b-222.js into the union"
[ -f "$test1_union/manifest.tsv" ] || fail "fresh run should write a manifest"
grep -q 'chunks/a-111.js' "$test1_union/manifest.tsv" || fail "manifest should record a-111.js"
grep -q 'chunks/b-222.js' "$test1_union/manifest.tsv" || fail "manifest should record b-222.js"

# --- Test 2: second build removes one file, adds one, and re-adds an -------
# --- existing filename with DIFFERENT content. Restore must bring back the
# --- removed file, and must never overwrite the current build's own file.
test2_union="$TMPDIR/t2/union"
test2_out="$TMPDIR/t2/out/_next/static/chunks"
mkdir -p "$test2_out"
printf 'content-a\n' > "$test2_out/a-111.js"
printf 'content-b\n' > "$test2_out/b-222.js"
run_merge "$TMPDIR/t2/union" "$TMPDIR/t2/out/_next/static" >/dev/null

rm -f "$test2_out/a-111.js"
printf 'content-b-NEW\n' > "$test2_out/b-222.js"
printf 'content-c\n' > "$test2_out/c-333.js"

output=$(run_merge "$TMPDIR/t2/union" "$TMPDIR/t2/out/_next/static" 2>&1)
printf '%s' "$output" | grep -q 'restored=1 ingested=1 pruned=0 union_total=3' \
  || fail "second run should restore the removed file and ingest the new one: $output"
[ -f "$test2_out/a-111.js" ] || fail "removed chunk a-111.js should be restored from the union"
[ "$(cat "$test2_out/a-111.js")" = "content-a" ] || fail "restored a-111.js should have union content"
[ "$(cat "$test2_out/b-222.js")" = "content-b-NEW" ] \
  || fail "current build's b-222.js must never be overwritten by the union copy"
[ -f "$test2_out/c-333.js" ] || fail "new chunk c-333.js should remain in output"

# --- Test 3: retention pruning removes entries older than RETENTION_SECONDS
# --- and does not restore them.
test3_union="$TMPDIR/t3/union"
test3_out="$TMPDIR/t3/out/_next/static/chunks"
mkdir -p "$test3_out" "$test3_union/files/chunks"
old_ts=$(( $(date +%s) - 259200 )) # 72h ago
printf 'stale-content\n' > "$test3_union/files/chunks/old-999.js"
printf 'chunks/old-999.js\t%s\n' "$old_ts" > "$test3_union/manifest.tsv"
printf 'content-a\n' > "$test3_out/a-111.js"

output=$(run_merge "$TMPDIR/t3/union" "$TMPDIR/t3/out/_next/static" 172800 512 2>&1)
printf '%s' "$output" | grep -q 'pruned=1' || fail "retention prune should remove exactly one stale entry: $output"
[ ! -e "$test3_out/old-999.js" ] || fail "expired union entry must not be restored"
[ ! -f "$test3_union/files/chunks/old-999.js" ] || fail "expired union entry must be deleted from the union store"
grep -q 'old-999.js' "$test3_union/manifest.tsv" && fail "expired entry must be removed from the manifest"
true

# --- Test 4: size-cap pruning deletes oldest-first once over budget. -------
test4_union="$TMPDIR/t4/union"
test4_out="$TMPDIR/t4/out/_next/static/chunks"
mkdir -p "$test4_out" "$test4_union/files/chunks"
now=$(date +%s)
for i in 1 2 3; do
  head -c 4000000 /dev/zero > "$test4_union/files/chunks/f${i}-old.js"
  ts=$(( now - (4 - i) * 100 )) # f1 is oldest, f3 is newest
  printf 'chunks/f%s-old.js\t%s\n' "$i" "$ts" >> "$test4_union/manifest.tsv"
done
printf 'content-a\n' > "$test4_out/a-111.js"

# The script sizes files with exact byte counts (find -printf '%s' / stat -c
# %s) and computes the cap as MAX_UNION_MEGABYTES * 1024 * 1024 (binary MiB).
# 3 x 4,000,000-byte files = 12,000,000 bytes against a 10MB cap
# (10,485,760 bytes) clears the "must prune" threshold with ~14% headroom
# even under the more permissive binary reading; removing just the oldest
# leaves 8,000,000 bytes against the same cap with ~24% headroom under the
# stricter decimal reading (10,000,000 bytes). Both margins comfortably
# exceed the ~4.86% gap between decimal (10^6) and binary (2^20) "MB", so
# "exactly the oldest is pruned" is deterministic under either arithmetic.
output=$(run_merge "$TMPDIR/t4/union" "$TMPDIR/t4/out/_next/static" 172800 10 2>&1)
printf '%s' "$output" | grep -q 'pruned=1' || fail "size-cap prune should remove exactly one file: $output"
[ ! -f "$test4_union/files/chunks/f1-old.js" ] || fail "oldest file f1 should be pruned first under the size cap"
[ -f "$test4_union/files/chunks/f2-old.js" ] || fail "newer file f2 should survive size-cap pruning"
[ -f "$test4_union/files/chunks/f3-old.js" ] || fail "newest file f3 should survive size-cap pruning"

# --- Test 4b: size-cap pruning also runs after ingesting the new build. ---
test4b_union="$TMPDIR/t4b/union"
test4b_out="$TMPDIR/t4b/out/_next/static/chunks"
mkdir -p "$test4b_out" "$test4b_union/files/chunks"
old_ts=$(( $(date +%s) - 3600 ))
head -c 4000000 /dev/zero > "$test4b_union/files/chunks/old-seed.js"
printf 'chunks/old-seed.js\t%s\n' "$old_ts" > "$test4b_union/manifest.tsv"
head -c 4000000 /dev/zero > "$test4b_out/new-a.js"
head -c 4000000 /dev/zero > "$test4b_out/new-b.js"

output=$(run_merge "$TMPDIR/t4b/union" "$TMPDIR/t4b/out/_next/static" 172800 10 2>&1)
printf '%s' "$output" | grep -q 'pruned=1' \
  || fail "post-ingest size-cap prune should remove the oldest cached file: $output"
[ ! -f "$test4b_union/files/chunks/old-seed.js" ] \
  || fail "post-ingest size-cap prune should remove the oldest pre-existing union file"
[ -f "$test4b_union/files/chunks/new-a.js" ] \
  || fail "post-ingest size-cap prune should keep the current build's first new chunk"
[ -f "$test4b_union/files/chunks/new-b.js" ] \
  || fail "post-ingest size-cap prune should keep the current build's second new chunk"
grep -q 'old-seed.js' "$test4b_union/manifest.tsv" \
  && fail "post-ingest pruned file must be removed from the manifest"

# --- Test 5: corrupted/missing manifest self-heals instead of failing. ------
test5_union="$TMPDIR/t5/union"
test5_out="$TMPDIR/t5/out/_next/static/chunks"
mkdir -p "$test5_out" "$test5_union/files/chunks"
printf 'orphan-content\n' > "$test5_union/files/chunks/orphan-555.js"
printf 'this is not a valid tsv manifest !!!\n' > "$test5_union/manifest.tsv"
printf 'content-a\n' > "$test5_out/a-111.js"

output=$(run_merge "$TMPDIR/t5/union" "$TMPDIR/t5/out/_next/static" 2>&1)
[ -f "$test5_out/orphan-555.js" ] \
  || fail "orphaned union file with a corrupted manifest should still self-heal and restore: $output"
grep -q 'chunks/orphan-555.js' "$test5_union/manifest.tsv" \
  || fail "self-heal should rebuild a manifest entry for the orphaned file"

# Missing manifest entirely (no manifest.tsv at all) must also self-heal.
test5b_union="$TMPDIR/t5b/union"
test5b_out="$TMPDIR/t5b/out/_next/static/chunks"
mkdir -p "$test5b_out" "$test5b_union/files/chunks"
printf 'orphan-content-2\n' > "$test5b_union/files/chunks/orphan-777.js"
printf 'content-a\n' > "$test5b_out/a-111.js"

run_merge "$TMPDIR/t5b/union" "$TMPDIR/t5b/out/_next/static" >/dev/null
[ -f "$test5b_out/orphan-777.js" ] || fail "missing manifest should self-heal and restore known union files"
[ -f "$test5b_union/manifest.tsv" ] || fail "missing manifest should be (re)written after a run"

# --- Test 6: fails clearly when OUTPUT_STATIC_DIR is missing. --------------
test6_union="$TMPDIR/t6/union"
set +e
error_output=$(run_merge "$test6_union" "$TMPDIR/t6/does-not-exist" 2>&1)
status=$?
set -e
[ "$status" -ne 0 ] || fail "missing OUTPUT_STATIC_DIR should exit non-zero"
printf '%s' "$error_output" | grep -qi 'OUTPUT_STATIC_DIR does not exist' \
  || fail "missing OUTPUT_STATIC_DIR should log a clear error message"

# --- Test 7: fails clearly when OUTPUT_STATIC_DIR exists but is empty. -----
test7_union="$TMPDIR/t7/union"
test7_out="$TMPDIR/t7/out/_next/static"
mkdir -p "$test7_out"
set +e
error_output=$(run_merge "$test7_union" "$test7_out" 2>&1)
status=$?
set -e
[ "$status" -ne 0 ] || fail "empty OUTPUT_STATIC_DIR should exit non-zero"
printf '%s' "$error_output" | grep -qi 'OUTPUT_STATIC_DIR is empty' \
  || fail "empty OUTPUT_STATIC_DIR should log a clear error message"

printf 'merge-static-union self-test passed\n'
