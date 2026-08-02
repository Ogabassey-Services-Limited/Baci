#!/usr/bin/bash
set -euo pipefail
export LC_ALL=C

temporary=
cleanup() { [[ -z $temporary ]] || : >"$temporary"; }
trap cleanup EXIT
trap 'cleanup; exit 1' HUP INT TERM

fail() {
  printf '%s\n' 'APT snapshot verification failed' >&2
  exit 1
}
digest() {
  local value
  value=$(/usr/bin/sha256sum "$1") || fail
  printf '%s' "${value%% *}"
}
ordered() {
  /usr/bin/awk 'NF { value[++count]=$0 } END { for(i=1;i<=count;i++) for(j=i+1;j<=count;j++) if(value[j]<value[i]) { swap=value[i]; value[i]=value[j]; value[j]=swap } for(i=1;i<=count;i++) print value[i] }' <<<"$1"
}

[[ $# -eq 7 ]] || fail
keyring=$1
lists=$2
selections=$3
snapshot=$4
sources=$5
base_receipt=$6
receipt=$7
[[ -f $keyring && ! -L $keyring && -d $lists ]] || fail
[[ -f $sources && ! -L $sources && -f $base_receipt && ! -L $base_receipt ]] || fail
[[ $snapshot =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || fail
[[ ! -e $receipt && ! -L $receipt && ${receipt%/*} != "$receipt" ]] || fail
[[ -d ${receipt%/*} && ! -L ${receipt%/*} ]] || fail
/usr/bin/awk -v RS='' -v snapshot="$snapshot" '
  {
    stanzas++; count=0; split($0,lines,"\n")
    for (i in lines) if (index(lines[i],"Snapshot:")==1) {
      count++; if (lines[i] != "Snapshot: " snapshot) bad=1
    }
    if (count != 1) bad=1
  }
  END { exit stanzas > 0 && !bad ? 0 : 1 }
' "$sources" || fail
base_receipt_sha=$(digest "$base_receipt")
keyring_sha=$(digest "$keyring")
sources_sha=$(digest "$sources")
/usr/bin/awk -v hash="$keyring_sha" '
  index($0, "\"role\":\"keyring\"") && index($0, "\"sha256\":\"" hash "\"") { count++ }
  END { exit count == 1 ? 0 : 1 }
' "$base_receipt" || fail

shopt -s nullglob
release_files=("$lists"/*_InRelease)
[[ ${#release_files[@]} -gt 0 ]] || fail
indexes=
releases=
package_paths=()
release_hashes=()
package_hashes=()
for release in "${release_files[@]}"; do
  [[ -f $release && ! -L $release ]] || fail
  /usr/bin/gpgv --keyring "$keyring" "$release" >/dev/null 2>&1 || fail
  /usr/bin/awk -v snapshot="$snapshot" '
    BEGIN {
      month["Jan"]="01"; month["Feb"]="02"; month["Mar"]="03"; month["Apr"]="04"
      month["May"]="05"; month["Jun"]="06"; month["Jul"]="07"; month["Aug"]="08"
      month["Sep"]="09"; month["Oct"]="10"; month["Nov"]="11"; month["Dec"]="12"
    }
    /^Snapshots: / {
      services++
      if ($0 !~ /^Snapshots: https:\/\/snapshot[.]ubuntu[.]com\/ubuntu\/@SNAPSHOTID@\/?$/) bad=1
    }
    /^Date: / {
      dates++; split($6,time,":")
      valid=NF==7 && $2 ~ /^[A-Z][a-z][a-z],$/ && $3 ~ /^[0-9][0-9]$/ && month[$4] &&
        $5 ~ /^[0-9][0-9][0-9][0-9]$/ && $6 ~ /^[0-9][0-9]:[0-9][0-9]:[0-9][0-9]$/ && $7=="UTC" &&
        $3+0>=1 && $3+0<=31 && time[1]+0<=23 && time[2]+0<=59 && time[3]+0<=60
      stamp=sprintf("%s%s%sT%s%s%sZ",$5,month[$4],$3,time[1],time[2],time[3])
      if (!valid || stamp > snapshot) bad=1
    }
    END { exit services == 1 && dates == 1 && !bad ? 0 : 1 }
  ' "$release" || fail
  release_name=${release##*/}
  release_sha=$(digest "$release")
  release_hashes+=("$release_sha" "$release")
  releases+="{\"path\":\"$release_name\",\"sha256\":\"$release_sha\"}"$'\n'
  prefix=${release%_InRelease}
  package_files=("$prefix"_*_binary-amd64_Packages)
  [[ ${#package_files[@]} -gt 0 ]] || fail
  for packages in "${package_files[@]}"; do
    [[ -f $packages && ! -L $packages ]] || fail
    suffix=${packages#"$prefix"_}
    component=${suffix%%_binary-amd64_Packages}
    [[ $component =~ ^[A-Za-z0-9.+-]+$ ]] || fail
    relative=$component/binary-amd64/Packages
    packages_sha=$(digest "$packages")
    package_hashes+=("$packages_sha" "$packages")
    packages_size=$(/usr/bin/stat -Lc '%s' "$packages") || fail
    matches=$(/usr/bin/awk -v hash="$packages_sha" -v size="$packages_size" -v path="$relative" '$1==hash && $2==size && $3==path { count++ } END { print count+0 }' "$release") || fail
    [[ $matches -eq 1 ]] || fail
    packages_name=${packages##*/}
    indexes+="{\"path\":\"$packages_name\",\"sha256\":\"$packages_sha\"}"$'\n'
    package_paths+=("$packages")
  done
done

selection_rows=
if [[ -d $selections ]]; then
  archives=("$selections"/*.deb)
  [[ ${#archives[@]} -gt 0 ]] || fail
  for archive in "${archives[@]}"; do
    [[ -f $archive && ! -L $archive ]] || fail
    archive_sha=$(digest "$archive")
    match=$(/usr/bin/awk -v RS='' -v hash="$archive_sha" '
      function field(key, lines, i) { split($0,lines,"\n"); for(i in lines) if(index(lines[i],key ": ")==1) return substr(lines[i],length(key)+3); return "" }
      field("SHA256")==hash { print field("Package") "\t" field("Version") "\t" field("Architecture") "\t" field("Filename") "\t" hash }
    ' "${package_paths[@]}") || fail
    [[ -n $match && $match != *$'\n'* ]] || fail
    selection_rows+="$match"$'\t'"$archive"$'\n'
  done
else
  [[ -f $selections && ! -L $selections ]] || fail
  while IFS= read -r selection; do selection_rows+="$selection"$'\n'; done <"$selections"
fi

rows=
seen=$'\n'
count=0
while IFS=$'\t' read -r name version architecture filename expected_sha archive extra; do
  [[ -n $name ]] || continue
  [[ -z ${extra:-} && -n $name && -n $version && $architecture == amd64 ]] || fail
  [[ $name =~ ^[A-Za-z0-9.+-]+$ && $version =~ ^[A-Za-z0-9.+:~=-]+$ ]] || fail
  [[ $filename =~ ^[A-Za-z0-9.+_/@:~-]+$ && $expected_sha =~ ^[0-9a-f]{64}$ ]] || fail
  [[ $name != google-* && $name != *chrome* && -f $archive && ! -L $archive ]] || fail
  [[ $(digest "$archive") == "$expected_sha" ]] || fail
  found=$(/usr/bin/awk -v RS='' -v name="$name" -v version="$version" -v architecture="$architecture" -v filename="$filename" -v hash="$expected_sha" '
    function field(key, lines, i) { split($0,lines,"\n"); for(i in lines) if(index(lines[i],key ": ")==1) return substr(lines[i],length(key)+3); return "" }
    field("Package")==name && field("Version")==version && field("Architecture")==architecture && field("Filename")==filename && field("SHA256")==hash { count++ } END { print count+0 }
  ' "${package_paths[@]}") || fail
  [[ $found -eq 1 ]] || fail
  row="{\"architecture\":\"$architecture\",\"filename\":\"$filename\",\"name\":\"$name\",\"sha256\":\"$expected_sha\",\"version\":\"$version\"}"
  [[ $seen != *$'\n'"$row"$'\n'* ]] || fail
  seen+="$row"$'\n'
  rows+="$row"$'\n'
  count=$((count + 1))
done <<<"$selection_rows"
[[ $count -gt 0 ]] || fail

sorted_indexes=$(ordered "$indexes")
sorted_releases=$(ordered "$releases")
sorted_rows=$(ordered "$rows")
temporary=$receipt.tmp.$$
emit() { local value=$1 separator=; while IFS= read -r row; do [[ -n $row ]] || continue; printf '%s%s' "$separator" "$row"; separator=,; done <<<"$value"; }
{
  printf '{"baseToolReceiptSha256":"%s","indexes":[' "$base_receipt_sha"
  emit "$sorted_indexes"
  printf '],"keyringSha256":"%s","packages":[' "$keyring_sha"
  emit "$sorted_rows"
  printf '],"releases":['
  emit "$sorted_releases"
  printf '],"schemaVersion":1,"snapshotId":"%s","sourcesSha256":"%s"}' "$snapshot" "$sources_sha"
} >"$temporary" || fail
expected_receipt_sha=$(digest "$temporary")
/usr/bin/mv "$temporary" "$receipt" || fail
temporary=
receipt_sha=$(digest "$receipt")
[[ $receipt_sha == "$expected_receipt_sha" && $(digest "$base_receipt") == "$base_receipt_sha" ]] || fail
[[ $(digest "$keyring") == "$keyring_sha" && $(digest "$sources") == "$sources_sha" ]] || fail
for ((index=0; index<${#release_hashes[@]}; index+=2)); do [[ $(digest "${release_hashes[index+1]}") == "${release_hashes[index]}" ]] || fail; done
for ((index=0; index<${#package_hashes[@]}; index+=2)); do [[ $(digest "${package_hashes[index+1]}") == "${package_hashes[index]}" ]] || fail; done
while IFS=$'\t' read -r name _ _ _ archive_sha archive _; do [[ -n $name ]] || continue; [[ $(digest "$archive") == "$archive_sha" ]] || fail; done <<<"$selection_rows"
printf '%s' "$receipt_sha"
