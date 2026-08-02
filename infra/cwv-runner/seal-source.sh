#!/bin/bash -p
set -euo pipefail
PATH=/usr/bin:/bin

readonly SHA=/usr/bin/sha256sum
readonly STAT=/usr/bin/stat
readonly CP=/bin/cp
readonly CHMOD=/bin/chmod
readonly CHOWN=/bin/chown
readonly MKDIR=/bin/mkdir
readonly MV=/bin/mv
readonly RM=/bin/rm
readonly TAR=/usr/bin/tar
readonly FIND=/usr/bin/find
readonly SORT=/usr/bin/sort
readonly GREP=/usr/bin/grep
readonly AWK=/usr/bin/awk
readonly SYNC=/usr/bin/sync
readonly FLOCK=/usr/bin/flock
readonly MKTEMP=/usr/bin/mktemp
readonly SELF=${BASH_SOURCE[0]}
readonly SELF_ROOT=/var/lib/baci-cwv/seal-source
readonly SELF_PARENT=${SELF%/*}
outer_self_copy=''

fail() { printf '%s\n' "seal-source: $*" >&2; exit 1; }
# Awk owns its field expressions.
# shellcheck disable=SC2016
sha() { "$SHA" -- "$1" | "$AWK" '{print $1}'; }
hex() { [[ "$1" =~ ^[0-9a-f]{64}$ ]] || fail 'invalid digest'; }
git_sha() { [[ "$1" =~ ^[0-9a-f]{40}$ ]] || fail 'invalid source SHA'; }

secure_self_root() {
  [[ -d "$SELF_ROOT" && ! -L "$SELF_ROOT" ]] || fail 'unsafe self-copy root'
  "$CHOWN" root:root -- "$SELF_ROOT"; "$CHMOD" 0700 -- "$SELF_ROOT"
  [[ "$("$STAT" -c '%u:%a' -- "$SELF_ROOT")" == '0:700' ]] || fail 'unsafe self-copy root'
}

validate_self_parent() {
  local parent=$1 suffix=${1#"$SELF_ROOT/work."}
  [[ "$parent" == "$SELF_ROOT"/work.* && "$suffix" =~ ^[A-Za-z0-9]{8}$ && -d "$parent" && ! -L "$parent" ]] || fail 'unsafe self-copy parent'
  [[ "$("$STAT" -c '%u:%a' -- "$parent")" == '0:700' ]] || fail 'unsafe self-copy parent'
}

cleanup_outer_self_copy() {
  local parent=$outer_self_copy suffix=${outer_self_copy#"$SELF_ROOT/work."}
  outer_self_copy=''
  [[ "$parent" == "$SELF_ROOT"/work.* && "$suffix" =~ ^[A-Za-z0-9]{8}$ && -d "$parent" && ! -L "$parent" ]] || return 0
  "$RM" -rf -- "$parent" || :
}

outer_exit() { cleanup_outer_self_copy; }
outer_signal() {
  cleanup_outer_self_copy
  trap - EXIT HUP INT TERM
  exit "$1"
}

cleanup_self_copy() { "$RM" -rf -- "$SELF_PARENT"; }

tmp='' target='' receipt='' target_owned=false receipt_owned=false committed=false
cleanup() {
  if [[ "$committed" != true ]]; then
    if [[ "$receipt_owned" == true ]]; then "$RM" -rf -- "$receipt"; fi
    if [[ "$target_owned" == true ]]; then "$RM" -rf -- "$target"; fi
  fi
  if [[ -n "$tmp" ]]; then "$RM" -rf -- "$tmp"; fi
  cleanup_self_copy
}

signal() {
  local code=$2
  cleanup
  trap - EXIT HUP INT TERM
  exit "$code"
}

self_copy() {
  local expected=${BACI_CWV_SEAL_SOURCE_RAW_SHA:-} copied parent
  hex "$expected"
  [[ -f "$SELF" && ! -L "$SELF" ]] || fail 'helper is not a regular file'
  "$MKDIR" -p -m 0700 -- "$SELF_ROOT"; secure_self_root
  parent=$("$MKTEMP" -d "$SELF_ROOT/work.XXXXXXXX") || fail 'self-copy directory unavailable'
  outer_self_copy=$parent
  trap outer_exit EXIT
  trap 'outer_signal 129' HUP
  trap 'outer_signal 130' INT
  trap 'outer_signal 143' TERM
  "$CHOWN" root:root -- "$parent"; "$CHMOD" 0700 -- "$parent"; validate_self_parent "$parent"
  copied="$parent/seal-source.sh"; "$CP" -- "$SELF" "$copied"
  [[ "$(sha "$copied")" == "$expected" ]] || fail 'helper raw digest mismatch'
  "$CHOWN" root:root -- "$copied"; "$CHMOD" 0500 -- "$copied"
  exec "$copied" --sealed-inner "$@"
}

verify_inner_helper() {
  [[ "$SELF" == "$SELF_PARENT/seal-source.sh" && -f "$SELF" && ! -L "$SELF" ]] || fail 'unsafe sealed helper'
  [[ -d "$SELF_PARENT" && ! -L "$SELF_PARENT" ]] || fail 'unsafe sealed helper'
  validate_self_parent "$SELF_PARENT"
  [[ "$("$STAT" -c '%u:%a' -- "$SELF")" == '0:500' ]] || fail 'unsafe sealed helper'
}

regular() {
  [[ -f "$1" && ! -L "$1" ]] || fail 'input is not a regular file'
  [[ "$($STAT -c '%u:%a' -- "$1")" == '0:600' || "$($STAT -c '%u:%a' -- "$1")" == '0:400' ]] || fail 'unsafe input ownership or mode'
}

digest_file() {
  regular "$1"
  local value
  value=$(<"$1")
  [[ "$value" =~ ^[0-9a-f]{64}$ ]] || fail 'invalid digest file'
  printf '%s' "$value"
}

canonical_manifest() {
  local manifest=$1 source_sha=$2 destination=$3
  "$GREP" -qE '^\{"authority":\{' "$manifest" || fail 'manifest is not canonical schema-v1 JSON'
  case "$destination" in
    scan)
      "$GREP" -qE '"schemaVersion":"preflight-v1"' "$manifest" || fail 'wrong preflight schema'
      "$GREP" -qE "\"reviewedHeadSha\":\"${source_sha}\"" "$manifest" || fail 'scan SHA mismatch' ;;
    final)
      "$GREP" -qE '"schemaVersion":1' "$manifest" || fail 'wrong final schema'
      "$GREP" -qE "\"mergeSha\":\"${source_sha}\"" "$manifest" || fail 'final SHA mismatch' ;;
    *) fail 'invalid destination' ;;
  esac
  "$GREP" -qE '"sourceArchive":\{"entries":\[' "$manifest" || fail 'missing archive projection'
  "$GREP" -qE '"prefix":"infra/cwv-runner/"' "$manifest" || fail 'wrong archive prefix'
}

manifest_rows() {
  # Awk extracts canonical JSON fields.
  # shellcheck disable=SC2016
  "$GREP" -oE '\{"blobSha256":"[0-9a-f]{64}","mode":"100(644|755)","path":"[^"\\]+"\}' -- "$1" |
    "$AWK" -F'"' '{print $12 "\t" $8 "\t" $4}'
}

safe_archive_names() {
  "$TAR" --list --file "$1" | "$AWK" '
    /^\// || /(^|\/)\.\.($|\/)/ || /\/\/|^$/ { exit 1 }
    { print }
  ' || fail 'unsafe archive member name'
}

verify_tree() {
  local tree=$1 rows=$2 actual=$3
  "$FIND" "$tree" -mindepth 1 \( -type l -o -type b -o -type c -o -type p -o -type s \) -print -quit | "$GREP" -q . && fail 'nonregular extracted member'
  "$FIND" "$tree" -type f -links +1 -print -quit | "$GREP" -q . && fail 'hardlinked extracted member'
  : > "$actual"
  while IFS=$'\t' read -r path mode digest; do
    [[ -n "$path" && "$path" == infra/cwv-runner/* ]] || fail 'invalid projected path'
    [[ "$path" != *'..'* && "$path" != /* ]] || fail 'unsafe projected path'
    local file="$tree/$path"
    [[ -f "$file" && ! -L "$file" && "$(sha "$file")" == "$digest" ]] || fail 'extracted member hash mismatch'
    "$CHMOD" "$([[ "$mode" == 100755 ]] && printf 0755 || printf 0644)" -- "$file"
    printf '%s\t%s\t%s\n' "$path" "$mode" "$digest" >> "$actual"
  done < "$rows"
  "$SORT" -c "$rows" || fail 'manifest archive rows are not sorted'
  local extracted
  extracted=$("$FIND" "$tree" -type f -print | "$AWK" -v root="$tree/" '{sub(root, ""); print}' | "$SORT")
  local expected
  # Awk prints the first manifest column.
  # shellcheck disable=SC2016
  expected=$("$AWK" -F'\t' '{print $1}' "$actual")
  [[ "$extracted" == "$expected" ]] || fail 'archive member set mismatch'
}

secure_tree_directories() {
  "$FIND" "$1" -type d -exec "$CHMOD" 0700 -- {} +
}

usage() { fail 'usage: seal-source.sh --destination scan|final --source-sha SHA --source-archive PATH --source-archive-sha256 SHA --source-manifest PATH --source-manifest-sha256 SHA'; }

inner=false
if [[ "${1:-}" == --sealed-inner ]]; then inner=true; shift; fi
arguments=("$@")
destination='' source_sha='' archive='' archive_digest='' manifest='' manifest_digest=''
while (($#)); do
  case "$1" in
    --destination|--source-sha|--source-archive|--source-archive-sha256|--source-manifest|--source-manifest-sha256)
      (($# >= 2)) || usage
      case "$1" in
        --destination) destination=$2 ;;
        --source-sha) source_sha=$2 ;;
        --source-archive) archive=$2 ;;
        --source-archive-sha256) archive_digest=$2 ;;
        --source-manifest) manifest=$2 ;;
        --source-manifest-sha256) manifest_digest=$2 ;;
      esac
      shift 2 ;;
    *) usage ;;
  esac
done
[[ -n "$destination" && -n "$source_sha" && -n "$archive" && -n "$archive_digest" && -n "$manifest" && -n "$manifest_digest" ]] || usage
git_sha "$source_sha"; hex "$archive_digest"; hex "$manifest_digest"
if [[ "$inner" == true ]]; then
  verify_inner_helper
  secure_self_root
  trap cleanup EXIT
  trap 'signal HUP 129' HUP
  trap 'signal INT 130' INT
  trap 'signal TERM 143' TERM
  exec 9<"$SELF_ROOT"
  "$FLOCK" -n 9 || fail 'source seal already running'
else
  self_copy "${arguments[@]}"
fi
regular "$archive"; regular "$manifest"

case "$destination" in
  scan) final_root=/var/lib/baci-cwv/preflight-source; receipt_root=/var/lib/baci-cwv/preflight-receipts ;;
  final) final_root=/srv/baci-cwv/source; receipt_root=/srv/baci-cwv/source-receipts ;;
  *) usage ;;
esac
target="$final_root/$source_sha"; receipt="$receipt_root/$source_sha"
[[ ! -e "$target" && ! -e "$receipt" ]] || fail 'sealed destination already exists'
"$MKDIR" -p -m 0700 -- "$final_root" "$receipt_root"
tmp="$final_root/.seal-${source_sha}-$$"; "$MKDIR" -m 0700 -- "$tmp"
root_archive="$tmp/archive"; root_manifest="$tmp/manifest.json"
"$CP" --preserve=mode -- "$archive" "$root_archive"
"$CP" --preserve=mode -- "$manifest" "$root_manifest"
"$CHOWN" root:root -- "$root_archive" "$root_manifest"; "$CHMOD" 0600 -- "$root_archive" "$root_manifest"
regular "$root_archive"; regular "$root_manifest"
[[ "$(sha "$root_archive")" == "$archive_digest" && "$(sha "$root_manifest")" == "$manifest_digest" ]] || fail 'root-copied input digest mismatch'
canonical_manifest "$root_manifest" "$source_sha" "$destination"
rows="$tmp/rows"; actual="$tmp/actual"; tree="$tmp/tree"; projection="$tree/infra/cwv-runner"
manifest_rows "$root_manifest" > "$rows"; [[ -s "$rows" ]] || fail 'empty archive projection'
safe_archive_names "$root_archive"
"$MKDIR" -m 0700 -- "$tree"
"$TAR" --extract --file "$root_archive" --directory "$tree" --no-same-owner --no-same-permissions --no-recursion
verify_tree "$tree" "$rows" "$actual"
[[ -d "$projection" && ! -L "$projection" ]] || fail 'archive projection root missing'
"$CHOWN" -R root:root -- "$tree"; secure_tree_directories "$tree"
tree_digest=$(sha "$actual")
hex "$tree_digest" || fail 'sealed tree digest mismatch'
"$SYNC" -f "$root_manifest"; "$SYNC" -f "$root_archive"; "$SYNC" -f "$tree"
target_owned=true
"$MV" -T -- "$projection" "$target"
receipt_owned=true; "$MKDIR" -m 0700 -- "$receipt"
"$CP" --preserve=mode -- "$root_manifest" "$receipt/manifest.json"
printf '%s\n' "$manifest_digest" > "$receipt/manifest.sha256"
printf '%s\n' "$archive_digest" > "$receipt/archive.sha256"
printf '%s\n' "$tree_digest" > "$receipt/tree.sha256"
printf '{"archiveSha256":"%s","manifestSha256":"%s","schemaVersion":1,"sealedTreeSha256":"%s","sourceSha":"%s"}\n' "$archive_digest" "$manifest_digest" "$tree_digest" "$source_sha" > "$receipt/seal-receipt.json"
"$CHOWN" -R root:root -- "$target" "$receipt"; secure_tree_directories "$target"; "$CHMOD" 0700 -- "$receipt"; "$CHMOD" 0600 -- "$receipt"/*
"$SYNC" -f "$receipt/seal-receipt.json"; "$SYNC" -f "$receipt"; "$SYNC" -f "$final_root"
committed=true
cleanup
trap - EXIT HUP INT TERM
printf '%s\n' "$target"
