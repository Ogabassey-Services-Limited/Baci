#!/bin/sh
# shellcheck disable=SC2034 # Module state is consumed by recovery scanner functions after sourcing.

recovery_open_process_file() {
  candidate=$1; process_root_real=$2
  /usr/bin/perl -MCwd=abs_path -MDigest::SHA -MJSON::PP -MFcntl=:DEFAULT,:mode -e '
    use strict; use warnings;
    my ($candidate, $root) = @ARGV;
    my $flags = O_RDONLY | O_NOFOLLOW | O_NONBLOCK; my $file;
    my (@opened, $kind, $descriptor_path);
    if (sysopen($file, $candidate, $flags)) {
      @opened = stat($file); exit 2 unless @opened;
      $kind = S_ISREG($opened[2]) ? "file" : S_ISDIR($opened[2]) ? "directory" : ""; exit 2 unless $kind;
      if ($^O eq "linux") {
        $descriptor_path = readlink("/proc/$$/fd/" . fileno($file));
        $descriptor_path =~ s/ \(deleted\)\z// if defined $descriptor_path;
      } elsif ($^O eq "darwin") {
        # Darwin F_GETPATH is the descriptor-bound equivalent of /proc/self/fd.
        my $buffer = "\0" x 1024;
        my $fcntl_result = fcntl($file, 50, $buffer);
        exit 2 unless defined $fcntl_result;
        $buffer =~ s/\0.*\z//s; $descriptor_path = $buffer;
      } else { exit 2; }
    } else {
      exit 1 if $!{ENOENT} || $!{ENOTDIR};
      @opened = lstat($candidate); exit 2 unless @opened && S_ISSOCK($opened[2]) && !S_ISLNK($opened[2]);
      $kind = "socket"; $descriptor_path = abs_path($candidate);
    }
    exit 2 unless defined($descriptor_path) && $descriptor_path =~ m{^/} && $descriptor_path !~ /[\r\n\t]/;
    exit 2 unless $root eq "/" || $descriptor_path eq $root || index($descriptor_path, "$root/") == 0;
    if ($kind ne "file") {
      my @current_link = lstat($candidate); my @current = stat($candidate);
      exit 2 unless @current_link && !S_ISLNK($current_link[2]) && @current;
      my $same_kind = $kind eq "directory" ? S_ISDIR($current[2]) : S_ISSOCK($current[2]);
      exit 2 unless $same_kind && $opened[0] == $current[0] && $opened[1] == $current[1];
      print JSON::PP->new->canonical->encode({kind => $kind, realPath => $descriptor_path}); exit 0;
    }
    my $digest = Digest::SHA->new(256); my $matched = 0; my $tail = "";
    while (1) {
      my $count = sysread($file, my $chunk, 65536); exit 2 unless defined $count; last unless $count;
      $digest->add($chunk); my $scan = $tail . $chunk; $matched ||= $scan =~ /ollama|11434/i; $tail = substr($scan, -16);
    }
    my @after_read = stat($file); exit 2 unless @after_read;
    for my $field (0, 1, 2, 4, 5, 7, 9, 10) { exit 2 unless $opened[$field] == $after_read[$field]; }
    my @current_link = lstat($candidate); my @current = stat($candidate);
    exit 2 unless @current_link && !S_ISLNK($current_link[2]) && @current && S_ISREG($current[2]) && $opened[0] == $current[0] && $opened[1] == $current[1];
    my $identity = join(":", $opened[0], $opened[1], $opened[4], $opened[5], sprintf("%o", $opened[2] & 07777), $opened[7]);
    print JSON::PP->new->canonical->encode({identity => $identity, kind => $kind, match => $matched ? JSON::PP::true : JSON::PP::false, realPath => $descriptor_path, sha256 => $digest->hexdigest});
  ' -- "$candidate" "$process_root_real"
}

recovery_process_file_cleanup() {
  for tracked in "$command_snapshot" "$environment_snapshot" "$arguments" "$descriptor"; do [ -z "$tracked" ] || /bin/rm -f -- "$tracked"; done
  command_snapshot=''; environment_snapshot=''; arguments=''; descriptor=''
}

recovery_process_file_evidence() {
  pid=$1; process_root="$RECOVERY_PROC_ROOT/$pid"; command_snapshot=''; environment_snapshot=''; arguments=''; descriptor=''
  [ -e "$process_root" ] || [ -L "$process_root" ] || { /usr/bin/jq -cn '{state:"vanished"}'; return; }
  before=$(recovery_process_lifetime_marker "$pid") || review_required 'process file lifetime unavailable'
  cmdline="$process_root/cmdline"; environment="$process_root/environ"; executable="$process_root/exe"
  [ -f "$cmdline" ] && [ ! -L "$cmdline" ] || review_required 'process command line unavailable'
  command_snapshot=$(temp_path); /bin/cat -- "$cmdline" >"$command_snapshot" || { recovery_process_file_cleanup; review_required 'process command line capture failed'; }
  if [ ! -L "$executable" ]; then
    state=$(sed 's/.*) //' "$process_root/stat" | awk '{print $1}')
    kthread=$(awk '/^Kthread:/{print $2; exit}' "$process_root/status")
    if [ ! -s "$command_snapshot" ] && { [ "$state" = Z ] || [ "$kthread" = 1 ]; }; then
      after=$(recovery_process_lifetime_marker "$pid") || { recovery_process_file_cleanup; review_required 'process file lifetime unavailable'; }
      [ "$before" = "$after" ] || { recovery_process_file_cleanup; review_required 'process file lifetime changed'; }
      recovery_process_file_cleanup; /usr/bin/jq -cn --arg lifetime "$after" '{lifetimeSha256:$lifetime,state:"inert"}'; return
    fi
    recovery_process_file_cleanup; review_required 'process executable link missing'
  fi
  observed=$(readlink -- "$executable") || { recovery_process_file_cleanup; review_required 'process executable target unavailable'; }
  observed=${observed% (deleted)}; case "$observed" in /*) :;; *) recovery_process_file_cleanup; review_required 'process executable path invalid';; esac
  executable_stat=$(stat -Lc '%d:%i:%u:%g:%a:%s' "$executable") || { recovery_process_file_cleanup; review_required 'process executable identity failed'; }
  executable_sha=$(sha "$executable") || { recovery_process_file_cleanup; review_required 'process executable digest failed'; }
  executable_match=''; if LC_ALL=C /usr/bin/grep -a -qiE 'ollama|11434' "$executable"; then executable_match=$executable_sha; else status=$?; [ "$status" -eq 1 ] || { recovery_process_file_cleanup; review_required 'process executable scan failed'; }; fi
  environment_snapshot=$(temp_path); environment_present=0; if [ -f "$environment" ] && [ ! -L "$environment" ]; then environment_present=1; /bin/cat -- "$environment" >"$environment_snapshot" || { recovery_process_file_cleanup; review_required 'process environment capture failed'; }; elif [ "$RECOVERY_PROC_ROOT" = /proc ]; then recovery_process_file_cleanup; review_required 'process environment unavailable'; else : >"$environment_snapshot"; fi
  arguments=$(temp_path); /usr/bin/perl -0ne 'BEGIN{$i=0} for(split(/\0/)){next if $i++==0; $p=$_; $p=$1 if $p=~/^[^=]+=(.*)$/; next if $p=~/[\r\n\t]/ || $p=~/^-/ || $p eq ""; if($p=~m{^/}){print "argument\troot\t$p\n"}elsif($p!~m{(^|/)\.\.(/|$)} && $p=~m{^[A-Za-z0-9._+@%/-]+$}){print "argument\tcwd\t$p\n"}}' "$command_snapshot" >"$arguments" || { recovery_process_file_cleanup; review_required 'process file argument parse failed'; }
  /usr/bin/perl -0ne 'for(split(/\0/)){next unless /^[A-Za-z_][A-Za-z0-9_]*=(.*)$/; $p=$1; next if $p=~/[\r\n\t]/ || $p eq ""; if($p=~m{^/}){print "environment\troot\t$p\n"}elsif($p!~m{(^|/)\.\.(/|$)} && $p=~m{^[A-Za-z0-9._+@%/-]+$}){print "environment\tcwd\t$p\n"}}' "$environment_snapshot" >>"$arguments" || { recovery_process_file_cleanup; review_required 'process environment file parse failed'; }
  argument_entries='[]'; tab=$(printf '\t'); while IFS="$tab" read -r origin scope argument || [ -n "$origin$scope$argument" ]; do
    case "$origin" in argument|environment) :;; *) recovery_process_file_cleanup; review_required 'process file origin invalid';; esac
    case "$scope" in root) anchor="$process_root/root"; candidate="$anchor$argument";; cwd) anchor="$process_root/cwd"; candidate="$anchor/$argument";; *) recovery_process_file_cleanup; review_required 'process file scope invalid';; esac
    process_root_anchor="$process_root/root"; [ -L "$process_root_anchor" ] && [ -L "$anchor" ] || { recovery_process_file_cleanup; review_required 'process file anchor unavailable'; }; process_root_before=$(readlink -- "$process_root_anchor") && anchor_before=$(readlink -- "$anchor") && process_root_real=$(readlink -f -- "$process_root_anchor") || { recovery_process_file_cleanup; review_required 'process file anchor unavailable'; }
    descriptor=$(temp_path); if recovery_open_process_file "$candidate" "$process_root_real" >"$descriptor"; then :; else status=$?; /bin/rm -f -- "$descriptor"; descriptor=''; [ "$status" -eq 1 ] && continue; recovery_process_file_cleanup; review_required 'process file argument descriptor failed'; fi
    descriptor_kind=$(/usr/bin/jq -er .kind "$descriptor") || { recovery_process_file_cleanup; review_required 'process file argument descriptor invalid'; }
    case "$descriptor_kind" in directory|socket) [ "$origin" = environment ] || { recovery_process_file_cleanup; review_required 'process file argument is a special target'; }; [ "$process_root_before" = "$(readlink -- "$process_root_anchor")" ] && [ "$anchor_before" = "$(readlink -- "$anchor")" ] || { recovery_process_file_cleanup; review_required 'process environment special target anchor changed'; }; /bin/rm -f -- "$descriptor"; descriptor=''; continue;; esac
    [ "$descriptor_kind" = file ] || { recovery_process_file_cleanup; review_required 'process file argument descriptor invalid'; }; real=$(/usr/bin/jq -er .realPath "$descriptor") && argument_stat=$(/usr/bin/jq -er .identity "$descriptor") && argument_sha=$(/usr/bin/jq -er .sha256 "$descriptor") && argument_matched=$(/usr/bin/jq -er .match "$descriptor") || { recovery_process_file_cleanup; review_required 'process file argument descriptor invalid'; }; /bin/rm -f -- "$descriptor"; descriptor=''
    argument_match=''; [ "$argument_matched" = false ] || argument_match=$argument_sha
    [ "$process_root_before" = "$(readlink -- "$process_root_anchor")" ] && [ "$anchor_before" = "$(readlink -- "$anchor")" ] || { recovery_process_file_cleanup; review_required 'process file argument anchor changed'; }
    argument_entries=$(/usr/bin/jq -cn --argjson old "$argument_entries" --arg origin "$origin" --arg scope "$scope" --arg path "$(hash_text "$real")" --arg sha "$argument_sha" --arg identity "$(hash_text "$argument_stat")" --arg match "$argument_match" '$old + [{origin:$origin,scope:$scope,realPathSha256:$path,sha256:$sha,identitySha256:$identity} + (if $match == "" then {} else {matchingSha256:$match} end)]') || { recovery_process_file_cleanup; die 'process file argument serialization failed'; }
  done <"$arguments"
  command_sha=$(sha "$cmdline") || { recovery_process_file_cleanup; review_required 'process command line digest failed'; }; environment_sha=$(sha "$environment_snapshot") || { recovery_process_file_cleanup; review_required 'process environment digest failed'; }
  after=$(recovery_process_lifetime_marker "$pid") || { recovery_process_file_cleanup; review_required 'process file lifetime unavailable'; }
  environment_current=$environment_snapshot; if [ "$environment_present" -eq 1 ]; then [ -f "$environment" ] && [ ! -L "$environment" ] || { recovery_process_file_cleanup; review_required 'process environment changed'; }; environment_current=$environment; fi; [ -f "$cmdline" ] && [ ! -L "$cmdline" ] && [ "$before" = "$after" ] && [ "$observed" = "$(readlink -- "$executable" | sed 's/ (deleted)$//')" ] && [ "$executable_stat" = "$(stat -Lc '%d:%i:%u:%g:%a:%s' "$executable")" ] && [ "$executable_sha" = "$(sha "$executable")" ] && [ "$command_sha" = "$(sha "$command_snapshot")" ] && [ "$command_sha" = "$(sha "$cmdline")" ] && [ "$environment_sha" = "$(sha "$environment_current")" ] || { recovery_process_file_cleanup; review_required 'process file evidence changed'; }
  recovery_process_file_cleanup
  /usr/bin/jq -cn --arg lifetime "$after" --arg path "$(hash_text "$observed")" --arg sha "$executable_sha" --arg identity "$(hash_text "$executable_stat")" --arg match "$executable_match" --argjson arguments "$argument_entries" '{lifetimeSha256:$lifetime,executable:({pathSha256:$path,sha256:$sha,identitySha256:$identity} + (if $match == "" then {} else {matchingSha256:$match} end)),fileArguments:$arguments}'
}

recovery_process_files_match() { /usr/bin/printf '%s\n' "$1" | /usr/bin/jq -e '(.executable.matchingSha256? // "") != "" or any(.fileArguments[]?; (.matchingSha256? // "") != "")' >/dev/null; }

recovery_record_process_file_consumer() {
  evidence=$1; digest=$(hash_text "$(/usr/bin/printf '%s\n' "$evidence" | /usr/bin/jq -S -c .)") || die 'process file evidence digest failed'; recovery_sha256 "$digest" || die 'invalid process file evidence digest'; unknown=$(hash_text unknown) || die 'process file dependency digest failed'
  deps=$(/usr/bin/jq -cn --argjson old "$deps" --arg value "$unknown" --arg source "$digest" '$old + [{"key-name":("running-processes:files:" + $source),"endpoint-class":"unknown","normalized-value-sha256":$value,"source-path-sha256":$source,disposition:"consumer"}]') || die 'process file dependency record failed'
  consumer_evidence=$(/usr/bin/jq -cn --argjson old "$consumer_evidence" --arg sha "$digest" '$old + [{surface:"running-processes",classifiedPathSha256:$sha}]') || die 'process file evidence record failed'
  consumer_counts=$(/usr/bin/jq -cn --argjson old "$consumer_counts" '$old | map(if .surface == "running-processes" then .matchCount += 1 else . end)') || die 'process file count record failed'
}

record_running_process_files() {
  file=$1; process_rows=$(temp_path); ancestry_rows=$(temp_path)
  # Strip the three ps identity fields once; preserve the complete argv suffix.
  awk 'NR==1 { if ($1=="PID" && $2=="PPID" && $3=="USER") next; bad=1; next } { pid=$1; ppid=$2; user=$3; if (pid!~/^[0-9]+$/ || ppid!~/^[0-9]+$/ || user=="" || NF<4) { bad=1; next } sub(/^[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+/,""); print pid " " ppid " " user " " $0 } END { exit bad?2:0 }' "$file" >"$process_rows" || { /bin/rm -f -- "$process_rows" "$ancestry_rows"; review_required 'invalid process file inventory'; }
  # Remove the retained user field for the ancestry parser's pid/ppid/argv shape.
  awk '{ pid=$1; ppid=$2; sub(/^[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+[^[:space:]]+[[:space:]]+/,""); print pid " " ppid " " $0 }' "$process_rows" >"$ancestry_rows" || { /bin/rm -f -- "$process_rows" "$ancestry_rows"; review_required 'invalid process ancestry inventory'; }
  RECOVERY_PROCESS_FILE=$ancestry_rows; RECOVERY_SELF_PID=${RECOVERY_SELF_PID:-$$}; RECOVERY_SCANNER_PID_SET=''; if awk -v pid="$RECOVERY_SELF_PID" '$1 == pid { found=1 } END { exit(found ? 0 : 1) }' "$ancestry_rows"; then recovery_build_scanner_ancestors; fi
  while IFS=' ' read -r pid ppid user args || [ -n "$pid$ppid$user$args" ]; do
    case "$pid" in PID) continue;; '') continue;; esac; [ "$pid" = "$RECOVERY_SELF_PID" ] && continue
    if process_line_approved "$pid $ppid $user $args"; then approved_live=$(recovery_process_lifetime_marker "$pid") || { /bin/rm -f -- "$process_rows" "$ancestry_rows"; review_required 'approved Ollama process identity unavailable'; }; [ "$approved_live" = "$APPROVED_OLLAMA_PROCESS_IDENTITY" ] && continue; fi
    command=${args%% *}; rest=${args#"$command"}; base=${command##*/}
    evidence=$(recovery_process_file_evidence "$pid"); state=$(printf '%s\n' "$evidence" | /usr/bin/jq -r '.state // "present"') || { /bin/rm -f -- "$process_rows" "$ancestry_rows"; review_required 'invalid process file evidence'; }; [ "$state" = vanished ] && continue
    if recovery_process_files_match "$evidence"; then if recovery_is_scanner_ancestor "$pid" && recovery_is_reviewed_scanner_command "$pid" "$base" "$command" "$rest"; then :; else recovery_record_process_file_consumer "$evidence"; fi; fi
  done <"$process_rows"; /bin/rm -f -- "$process_rows" "$ancestry_rows"
}
