#!/usr/bin/env bash
# Merge a persistent "union" of recent Next.js static chunk files into a
# freshly built .vercel/output/static/_next/static directory.
#
# WHY: every production deploy replaces content-hashed chunk filenames.
# Clients holding stale HTML (from before the deploy) request the OLD
# filenames, which no longer exist in the new deployment's static output,
# and Vercel skew protection does not rescue every case. Content-hashed
# filenames make a union safe: identical filename implies identical
# content, and this script never overwrites a file the current build
# produced. See docs/incidents/2026-07-02-chunk-load-recovery-problem-statement.md
# for the observed symptom this defends against.
#
# Interface (env vars):
#   UNION_DIR            required. Persistent union store. Layout:
#                           $UNION_DIR/files/<relative path under _next/static>
#                           $UNION_DIR/manifest.tsv  (relative-path \t first-seen-epoch)
#   OUTPUT_STATIC_DIR     required. Freshly built static root, e.g.
#                           .vercel/output/static/_next/static
#   RETENTION_SECONDS     optional. Default 172800 (48h).
#   MAX_UNION_MEGABYTES   optional. Default 512.
#
# Behavior, in order: validate -> load manifest (self-healing) -> prune
# (retention, then size cap) -> ingest current build -> restore missing
# files into the current build -> write manifest atomically.
set -euo pipefail

log() {
  printf '[merge-static-union] %s\n' "$1" >&2
}

fail() {
  log "ERROR: $1"
  exit 1
}

UNION_DIR="${UNION_DIR:?UNION_DIR env var is required}"
OUTPUT_STATIC_DIR="${OUTPUT_STATIC_DIR:?OUTPUT_STATIC_DIR env var is required}"
RETENTION_SECONDS="${RETENTION_SECONDS:-172800}"
MAX_UNION_MEGABYTES="${MAX_UNION_MEGABYTES:-512}"

# Strip any trailing slash now that both dirs are validated as present. The
# "${file#"$DIR"/}" prefix-stripping below assumes a single-slash boundary
# (find always emits single-slash paths); a caller-supplied trailing slash
# would otherwise make the prefix stripping a no-op and leave relpath equal
# to the full absolute path.
UNION_DIR="${UNION_DIR%/}"
OUTPUT_STATIC_DIR="${OUTPUT_STATIC_DIR%/}"

# --- Step 1: validate the freshly built static output exists and is non-empty.
# A missing/empty build output means this run has nothing safe to protect;
# fail loudly here. The caller (deploy workflow) is expected to wrap this
# script so a failure here does not block the deploy itself (a deploy
# without the union is strictly better than no deploy) — see deploy.yml.
[ -d "$OUTPUT_STATIC_DIR" ] || fail "OUTPUT_STATIC_DIR does not exist: $OUTPUT_STATIC_DIR"
if [ -z "$(find "$OUTPUT_STATIC_DIR" -mindepth 1 -print -quit 2>/dev/null)" ]; then
  fail "OUTPUT_STATIC_DIR is empty: $OUTPUT_STATIC_DIR"
fi

UNION_FILES_DIR="$UNION_DIR/files"
MANIFEST="$UNION_DIR/manifest.tsv"
mkdir -p "$UNION_FILES_DIR"

# --- Step 2: load the manifest, tolerating drift between it and the files
# actually on disk (self-heal in both directions).
declare -A MANIFEST_TS=()

if [ -f "$MANIFEST" ]; then
  while IFS=$'\t' read -r relpath firstseen || [ -n "$relpath" ]; do
    [ -n "$relpath" ] || continue
    case "$firstseen" in
      '' | *[!0-9]*) continue ;; # malformed timestamp -> drop entry, self-heal below
    esac
    # Manifest references a file that no longer exists on disk: drop it
    # rather than trusting stale metadata (self-heal).
    [ -f "$UNION_FILES_DIR/$relpath" ] && MANIFEST_TS["$relpath"]="$firstseen"
  done < "$MANIFEST"
fi

# Files present under UNION_FILES_DIR with no manifest entry (e.g. manifest
# was corrupted/missing): rebuild an entry using the file's mtime, falling
# back to "now" if mtime is unavailable.
while IFS= read -r -d '' file; do
  relpath="${file#"$UNION_FILES_DIR"/}"
  if [ -z "${MANIFEST_TS[$relpath]+x}" ]; then
    ts=$(stat -c %Y "$file" 2>/dev/null || date +%s)
    MANIFEST_TS["$relpath"]="$ts"
  fi
done < <(find "$UNION_FILES_DIR" -type f -print0 2>/dev/null)

now=$(date +%s)
pruned_count=0
pruned_bytes=0

# --- Step 3a: retention prune — drop anything older than RETENTION_SECONDS.
for relpath in "${!MANIFEST_TS[@]}"; do
  firstseen="${MANIFEST_TS[$relpath]}"
  age=$(( now - firstseen ))
  if [ "$age" -gt "$RETENTION_SECONDS" ]; then
    file="$UNION_FILES_DIR/$relpath"
    if [ -f "$file" ]; then
      size=$(stat -c %s "$file" 2>/dev/null || echo 0)
      pruned_bytes=$(( pruned_bytes + size ))
      rm -f "$file"
    fi
    unset -v "MANIFEST_TS[$relpath]"
    pruned_count=$(( pruned_count + 1 ))
  fi
done

# --- Step 3b: size-cap prune — if still over budget, delete oldest-first.
max_bytes=$(( MAX_UNION_MEGABYTES * 1024 * 1024 ))
total_bytes=$(find "$UNION_FILES_DIR" -type f -printf '%s\n' 2>/dev/null | awk '{sum+=$1} END {print sum+0}')

if [ "$total_bytes" -gt "$max_bytes" ]; then
  while IFS=$'\t' read -r _ts relpath; do
    [ "$total_bytes" -le "$max_bytes" ] && break
    [ -n "$relpath" ] || continue
    file="$UNION_FILES_DIR/$relpath"
    if [ -f "$file" ]; then
      size=$(stat -c %s "$file" 2>/dev/null || echo 0)
      rm -f "$file"
      total_bytes=$(( total_bytes - size ))
      pruned_bytes=$(( pruned_bytes + size ))
    fi
    unset -v "MANIFEST_TS[$relpath]"
    pruned_count=$(( pruned_count + 1 ))
  done < <(
    for relpath in "${!MANIFEST_TS[@]}"; do
      printf '%s\t%s\n' "${MANIFEST_TS[$relpath]}" "$relpath"
    done | sort -n -k1,1
  )
fi

find "$UNION_FILES_DIR" -mindepth 1 -type d -empty -delete 2>/dev/null || true

pruned_mb=$(awk -v b="$pruned_bytes" 'BEGIN{printf "%.2f", b/1024/1024}')
log "prune: removed ${pruned_count} file(s), ${pruned_mb}MB"

# --- Step 4: ingest the current build into the union (new paths only; keep
# existing first-seen for paths the union already knew about).
ingested_count=0
while IFS= read -r -d '' file; do
  relpath="${file#"$OUTPUT_STATIC_DIR"/}"
  dest="$UNION_FILES_DIR/$relpath"
  if [ ! -f "$dest" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -p "$file" "$dest"
    MANIFEST_TS["$relpath"]="$now"
    ingested_count=$(( ingested_count + 1 ))
  fi
done < <(find "$OUTPUT_STATIC_DIR" -type f -print0)

# --- Step 5: restore union files the current build did not produce. Never
# overwrite a file the current build already wrote.
restored_count=0
while IFS= read -r -d '' file; do
  relpath="${file#"$UNION_FILES_DIR"/}"
  dest="$OUTPUT_STATIC_DIR/$relpath"
  if [ ! -e "$dest" ]; then
    mkdir -p "$(dirname "$dest")"
    cp -p "$file" "$dest"
    restored_count=$(( restored_count + 1 ))
  fi
done < <(find "$UNION_FILES_DIR" -type f -print0)

union_total=${#MANIFEST_TS[@]}
log "restored=${restored_count} ingested=${ingested_count} pruned=${pruned_count} union_total=${union_total}"

# --- Step 6: write the manifest atomically.
tmp_manifest="$MANIFEST.tmp.$$"
: > "$tmp_manifest"
for relpath in "${!MANIFEST_TS[@]}"; do
  printf '%s\t%s\n' "$relpath" "${MANIFEST_TS[$relpath]}" >> "$tmp_manifest"
done
mv -f "$tmp_manifest" "$MANIFEST"
