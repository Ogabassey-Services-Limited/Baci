#!/bin/bash -p
set -euo pipefail
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
export PATH

readonly SSH_BIN=/usr/bin/ssh SSH_KEYGEN_BIN=/usr/bin/ssh-keygen PERL_BIN=/usr/bin/perl ENV_BIN=/usr/bin/env
readonly LINUX_SHA256_BIN=/usr/bin/sha256sum DARWIN_SHA256_BIN=/usr/bin/shasum UNAME_BIN=/usr/bin/uname
readonly EXPECTED_SHA256=d73d074536e1beaf206f23994fe01d6116d8e3cfdd8b759be450d8f781567d66
readonly EXPECTED_FINGERPRINT=SHA256:irNFP+fnGB0cPJDSXKvbuxAf8qN1kNfsrc/V1TcXM7o
SCRIPT_DIR="$(CDPATH='' cd -- "$(/usr/bin/dirname -- "${BASH_SOURCE[0]}")" && /bin/pwd -P)"
readonly SCRIPT_DIR
KNOWN_HOSTS="$SCRIPT_DIR/ogabassey-known-hosts"
OWNER_UID="$(/usr/bin/id -u)"
readonly KNOWN_HOSTS OWNER_UID

die() { printf '%s\n' 'baci-cwv SSH authority verification failed' >&2; exit 64; }
[[ -z "${CWV_KNOWN_HOSTS_READY:-}" && -z "${CWV_KNOWN_HOSTS_FD:-}" ]] || die
tty=-T
if [[ "${1:-}" == --tty ]]; then tty=-tt; shift; fi
[[ "${1:-}" == -- ]] || die
shift
(( $# <= 1 )) || die
(( $# == 0 )) || [[ -n "$1" ]] || die

# shellcheck disable=SC2016 # The fixed Perl program is intentionally single-quoted.
exec "$ENV_BIN" -i PATH="$PATH" "$PERL_BIN" -MFcntl=O_RDONLY,O_NOFOLLOW,F_GETFD,F_SETFD,FD_CLOEXEC -MFile::Temp=tempfile -e '
  sub fail { print STDERR "baci-cwv SSH authority verification failed\n"; exit 64 }
  sub output {
    open(my $pipe, "-|", @_) or fail();
    my $value = do { local $/; <$pipe> };
    close $pipe or fail();
    defined $value or fail();
    return $value;
  }
  my ($source, $ssh, $keygen, $uname, $linux_sha, $darwin_sha, $expected_sha, $expected_fingerprint, $uid, $tty, $command) = @ARGV;
  sysopen(my $input, $source, O_RDONLY | O_NOFOLLOW) or fail();
  my @source = stat($input) or fail();
  -f _ && $source[4] == $uid && (($source[2] & 07777) == 0644) && $source[7] <= 4096 or fail();
  my ($projection, $path) = tempfile("baci-cwv-known-hosts-XXXXXX", DIR => "/tmp", UNLINK => 0);
  chmod 0600, $path or fail();
  my $total = 0;
  while (1) {
    my $count = sysread($input, my $bytes, 4096);
    defined $count or fail(); last if $count == 0;
    $total += $count; $total <= 4096 or fail();
    for (my $offset = 0; $offset < $count;) {
      my $written = syswrite($projection, $bytes, $count - $offset, $offset);
      defined $written && $written > 0 or fail(); $offset += $written;
    }
  }
  close $input or fail(); close $projection or fail();
  sysopen(my $frozen, $path, O_RDONLY | O_NOFOLLOW) or fail(); unlink $path or fail();
  my @frozen = stat($frozen) or fail();
  -f _ && $frozen[4] == $uid && (($frozen[2] & 07777) == 0600) && $frozen[3] == 0 or fail();
  my $fd_flags = fcntl($frozen, F_GETFD, 0);
  defined $fd_flags && fcntl($frozen, F_SETFD, $fd_flags & ~FD_CLOEXEC) or fail();
  my $known_hosts = "/dev/fd/" . fileno($frozen);
  my $platform = output($uname, "-s");
  my $digest = $platform eq "Linux\n" ? output($linux_sha, $known_hosts) : $platform eq "Darwin\n" ? output($darwin_sha, "-a", "256", $known_hosts) : fail();
  $digest =~ /\A([0-9a-f]{64})\s/ && $1 eq $expected_sha or fail();
  sysseek($frozen, 0, 0) or fail();
  my $fingerprint = output($keygen, "-lf", $known_hosts, "-E", "sha256");
  $fingerprint eq "256 $expected_fingerprint 82.29.190.219 (ED25519)\n" or fail();
  sysseek($frozen, 0, 0) or fail();
  my $authority = do { local $/; <$frozen> };
  defined $authority && $authority =~ s/\n\z// && $authority !~ /\x27/ or fail();
  my $known_hosts_command = "/bin/echo \x27$authority\x27";
  my @args = ("-F", "/dev/null", $tty, "-o", "BatchMode=yes", "-o", "ServerAliveInterval=15", "-o", "ServerAliveCountMax=12", "-o", "TCPKeepAlive=yes", "-o", "IdentitiesOnly=yes", "-o", "HostKeyAlgorithms=ssh-ed25519", "-o", "StrictHostKeyChecking=yes", "-o", "CheckHostIP=yes", "-o", "GlobalKnownHostsFile=none", "-o", "UserKnownHostsFile=none", "-o", "KnownHostsCommand=$known_hosts_command", "-o", "ProxyCommand=none", "-o", "ProxyJump=none", "-o", "PermitLocalCommand=no", "-o", "ClearAllForwardings=yes", "-o", "ForwardAgent=no", "-o", "ForwardX11=no", "-o", "ControlMaster=no", "-o", "ControlPath=none", "-o", "ControlPersist=no", "-o", "IdentityAgent=none", "-o", "Tunnel=no", "-p", "22", "bassey\@82.29.190.219");
  push @args, $command if length $command;
  exec {$ssh} $ssh, @args;
  fail();
' -- "$KNOWN_HOSTS" "$SSH_BIN" "$SSH_KEYGEN_BIN" "$UNAME_BIN" "$LINUX_SHA256_BIN" "$DARWIN_SHA256_BIN" "$EXPECTED_SHA256" "$EXPECTED_FINGERPRINT" "$OWNER_UID" "$tty" "${1:-}"
