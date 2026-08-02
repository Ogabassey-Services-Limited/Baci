#!/usr/bin/bash
set -euo pipefail
export LC_ALL=C

temporary=
cleanup() { [[ -z $temporary ]] || : >"$temporary"; }
trap cleanup EXIT
trap 'cleanup; exit 1' HUP INT TERM

valid_sha() { [[ $1 =~ ^[0-9a-f]{64}$ ]]; }
digest() {
  local value
  value=$(/usr/bin/sha256sum "$1")
  printf '%s' "${value%% *}"
}
same_digest() { valid_sha "$2" && [[ $(digest "$1") == "$2" ]]; }

augment() {
  [[ $# -eq 6 ]] || exit 64
  local bootstrap=$1 expected_bootstrap=$2 base_receipt=$3
  local expected_base=$4 executable=$5 receipt=$6 bytes pattern executable_sha
  for path in "$bootstrap" "$base_receipt" "$executable"; do
    [[ -f $path && ! -L $path ]] || exit 1
  done
  [[ -x $executable ]] || exit 1
  same_digest "$bootstrap" "$expected_bootstrap" || exit 1
  same_digest "$base_receipt" "$expected_base" || exit 1
  [[ $(/usr/bin/wc -l <"$bootstrap") -eq 0 ]] || exit 1
  pattern='^\{"archiveBasename":"[A-Za-z0-9._+-]+","archiveSha256":"[0-9a-f]{64}","baseToolReceiptSha256":"[0-9a-f]{64}","checksumsSha256":"[0-9a-f]{64}","keyringSha256":"[0-9a-f]{64}","schemaVersion":1,"signatureSha256":"[0-9a-f]{64}"\}$'
  bytes=$(<"$bootstrap")
  [[ $bytes =~ $pattern ]] || exit 1
  [[ $bytes == *\"baseToolReceiptSha256\":\"$expected_base\"* ]] || exit 1
  [[ ! -e $receipt && ! -L $receipt && ${receipt%/*} != "$receipt" ]] || exit 1
  [[ -d ${receipt%/*} && ! -L ${receipt%/*} ]] || exit 1
  executable_sha=$(digest "$executable")
  temporary=$receipt.tmp.$$
  printf '%s' "${bytes/,\"keyringSha256\"/,\"executableSha256\":\"$executable_sha\",\"keyringSha256\"}" >"$temporary"
  /usr/bin/chmod 0444 "$temporary"
  expected_receipt_sha=$(digest "$temporary")
  same_digest "$temporary" "$expected_receipt_sha" || exit 1
  /usr/bin/mv "$temporary" "$receipt"
  temporary=
  same_digest "$bootstrap" "$expected_bootstrap" || exit 1
  same_digest "$base_receipt" "$expected_base" || exit 1
  same_digest "$executable" "$executable_sha" || exit 1
  printf '%s' "$(digest "$receipt")"
}

if [[ ${1:-} == augment ]]; then
  shift
  augment "$@"
  exit
fi

[[ $# -eq 11 ]] || exit 64
archive=$1
sums=$2
signature=$3
keyring=$4
expected_archive=$5
expected_sums=$6
expected_signature=$7
expected_keyring=$8
expected_base_receipt=$9
base_receipt=${10}
receipt=${11}

for path in "$archive" "$sums" "$signature" "$keyring" "$base_receipt"; do
  [[ -f $path && ! -L $path ]] || exit 1
done
for pair in "$archive:$expected_archive" "$sums:$expected_sums" \
  "$signature:$expected_signature" "$keyring:$expected_keyring" \
  "$base_receipt:$expected_base_receipt"; do
  path=${pair%%:*}
  expected=${pair##*:}
  same_digest "$path" "$expected" || exit 1
done
base_receipt_sha=$(digest "$base_receipt")
/usr/bin/gpgv --keyring "$keyring" "$signature" "$sums" >/dev/null 2>&1 || exit 1
archive_name=${archive##*/}
[[ $archive_name =~ ^[A-Za-z0-9._+-]+$ ]] || exit 1
row_count=$(/usr/bin/awk -v name="$archive_name" '$2 == name || $2 == "*" name { count += 1 } END { print count + 0 }' "$sums")
[[ $row_count -eq 1 ]] || exit 1
row_digest=$(/usr/bin/awk -v name="$archive_name" '$2 == name || $2 == "*" name { print $1 }' "$sums")
[[ $row_digest == "$expected_archive" ]] || exit 1
[[ ! -e $receipt && ! -L $receipt && ${receipt%/*} != "$receipt" ]] || exit 1
[[ -d ${receipt%/*} && ! -L ${receipt%/*} ]] || exit 1
temporary=$receipt.tmp.$$
printf '{"archiveBasename":"%s","archiveSha256":"%s","baseToolReceiptSha256":"%s","checksumsSha256":"%s","keyringSha256":"%s","schemaVersion":1,"signatureSha256":"%s"}' \
  "$archive_name" "$expected_archive" "$base_receipt_sha" "$expected_sums" "$expected_keyring" "$expected_signature" >"$temporary"
expected_receipt_sha=$(digest "$temporary")
same_digest "$temporary" "$expected_receipt_sha" || exit 1
/usr/bin/mv "$temporary" "$receipt"
temporary=
receipt_sha=$(digest "$receipt")
[[ $receipt_sha == "$expected_receipt_sha" ]] || exit 1
[[ $(digest "$base_receipt") == "$expected_base_receipt" ]] || exit 1
for pair in "$archive:$expected_archive" "$sums:$expected_sums" \
  "$signature:$expected_signature" "$keyring:$expected_keyring"; do
  path=${pair%%:*}
  expected=${pair##*:}
  [[ $(digest "$path") == "$expected" ]] || exit 1
done
printf '%s' "$receipt_sha"
