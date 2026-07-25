#!/usr/bin/bash
set -euo pipefail
export LC_ALL=C
fail() { exit 1; }

[[ $# -eq 3 ]] || exit 64
base_image=$1
inventory=$2
receipt=$3
[[ $base_image =~ ^ubuntu@sha256:[0-9a-f]{64}$ ]] || fail
[[ -f $inventory && ! -L $inventory && ! -e $receipt && ! -L $receipt ]] || fail
receipt_parent=${receipt%/*}
[[ $receipt_parent != "$receipt" && -d $receipt_parent && ! -L $receipt_parent ]] || fail
temporary=
cleanup() { [[ -z $temporary ]] || /usr/bin/rm -f -- "$temporary"; }
trap cleanup EXIT
trap 'cleanup; exit 1' HUP INT TERM

digest() {
  local value
  value=$(/usr/bin/sha256sum "$1")
  printf '%s' "${value%% *}"
}
required=(apt-get awk awk:alternative awk:target base64 bash chmod cp dpkg dpkg-query find gpgv grep ldd mkdir mktemp mv readlink rm sha256sum sort stat timeout wc keyring)
seen_roles=$'\n'
tools=()
previous=
has_interpreter=false
has_library=false
link_pattern="^['A-Za-z0-9_./+[:space:]>-]+$"
while IFS=$'\t' read -r role path package version mode owner link_identity expected extra; do
  [[ -z ${extra:-} && -n $role && $role > $previous && $path == /* ]] || fail
  [[ $role =~ ^[A-Za-z0-9:._/-]+$ && $path =~ ^[A-Za-z0-9_./+-]+$ ]] || fail
  case $role in
    apt-get|awk|awk:alternative|awk:target|base64|bash|chmod|cp|dpkg|dpkg-query|find|gpgv|grep|ldd|mkdir|mktemp|mv|readlink|rm|sha256sum|sort|stat|timeout|wc|keyring|interpreter:*|library:*) ;;
    *) fail ;;
  esac
  [[ $package =~ ^[A-Za-z0-9.+-]+$ && $version =~ ^[A-Za-z0-9.+:~=-]+$ ]] || fail
  [[ $mode =~ ^[0-7]{3,4}$ && $owner =~ ^[0-9]+:[0-9]+$ ]] || fail
  [[ $link_identity =~ $link_pattern ]] || fail
  [[ $expected =~ ^[0-9a-f]{64}$ && -e $path ]] || fail
  [[ $(digest "$path") == "$expected" ]] || fail
  [[ $(/usr/bin/stat -Lc '%a' "$path") == "$mode" ]] || fail
  [[ $(/usr/bin/stat -Lc '%u:%g' "$path") == "$owner" ]] || fail
  [[ $(/usr/bin/stat -c '%N' "$path") == "$link_identity" ]] || fail
  case $role in
    awk|awk:alternative) [[ $package == mawk ]] || fail ;;
    *) ownership=$(/usr/bin/dpkg-query -S "$path"); [[ ${ownership%%:*} == "$package" ]] || fail ;;
  esac
  installed=$(/usr/bin/dpkg-query -W -f='${Version}' "$package")
  [[ $installed == "$version" ]] || fail
  [[ $seen_roles != *$'\n'"$role"$'\n'* ]] || fail
  seen_roles+="$role"$'\n'
  [[ $role == interpreter:* ]] && has_interpreter=true
  [[ $role == library:* ]] && has_library=true
  tools+=("{\"linkIdentity\":\"$link_identity\",\"mode\":\"$mode\",\"owner\":\"$owner\",\"package\":\"$package\",\"path\":\"$path\",\"role\":\"$role\",\"sha256\":\"$expected\",\"version\":\"$version\"}")
  previous=$role
done <"$inventory"
for role in "${required[@]}"; do [[ $seen_roles == *$'\n'"$role"$'\n'* ]] || fail; done
[[ $has_interpreter == true && $has_library == true ]] || fail
[[ $seen_roles == *$'\nkeyring\n'* ]] || fail
keyring_path=
for row in "${tools[@]}"; do
  [[ $row == *'"role":"keyring"'* ]] && keyring_path=$row
done
[[ $keyring_path == *'"path":"/usr/share/keyrings/ubuntu-archive-keyring.gpg"'* ]] || fail

temporary=$receipt.tmp.$$
{
  printf '{"baseImageDigest":"%s","inventorySha256":"%s","schemaVersion":1,"tools":[' "$base_image" "$(digest "$inventory")"
  separator=
  for row in "${tools[@]}"; do printf '%s%s' "$separator" "$row"; separator=,; done
  printf ']}'
} >"$temporary"
/usr/bin/mv "$temporary" "$receipt"
temporary=
while IFS=$'\t' read -r _ path _ _ _ _ _ expected _; do
  [[ $(digest "$path") == "$expected" ]] || fail
done <"$inventory"
printf '%s' "$(digest "$receipt")"
