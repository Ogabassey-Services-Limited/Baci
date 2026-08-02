// biome-ignore-all format: compact race fixtures stay within the 300-line contract
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { promisify } from 'node:util';

const exec = promisify(execFile);
const root = new URL('./', import.meta.url);
const source = await fs.readFile(new URL('./vps-ssh.sh', root), 'utf8');
const hosts = await fs.readFile(new URL('./ogabassey-known-hosts', root), 'utf8');
const fingerprint = 'SHA256:irNFP+fnGB0cPJDSXKvbuxAf8qN1kNfsrc/V1TcXM7o';
async function fixture({ badFingerprint = false, platform = 'Linux', replaceAfterDigest = false } = {}) {
  const dir = await fs.mkdtemp(join(tmpdir(), 'baci-cwv-ssh-'));
  const bin = join(dir, 'bin');
  await fs.mkdir(bin);
  const capture = join(dir, 'argv');
  const knownHostsCapture = join(dir, 'known-hosts-consumed');
  const replacement = join(dir, 'replacement-known-hosts');
  const paths = Object.fromEntries(
    ['ssh', 'ssh-keygen', 'sha256sum', 'shasum', 'uname'].map(
      (name) => [name, join(bin, name)]
    )
  );
  await fs.writeFile(join(dir, 'ogabassey-known-hosts'), hosts);
  await fs.chmod(join(dir, 'ogabassey-known-hosts'), 0o644);
  if (replaceAfterDigest)
    await fs.writeFile(replacement, '82.29.190.219 ssh-ed25519 attacker\n');
  await fs.writeFile(
    paths.ssh,
    `#!${process.execPath}\nconst fs=require("node:fs"),known=process.argv.find((value)=>value.startsWith("KnownHostsCommand="));if(known)fs.writeFileSync(${JSON.stringify(knownHostsCapture)},known.slice("KnownHostsCommand=".length));fs.writeFileSync(${JSON.stringify(capture)},process.argv.slice(2).join("\\n")+"\\n");\n`
  );
  await fs.writeFile(
    paths['ssh-keygen'],
    `#!/bin/bash -p\nprintf '%s\\n' '256 ${badFingerprint ? 'SHA256:wrong' : fingerprint} 82.29.190.219 (ED25519)'\n`
  );
  await fs.writeFile(
    paths.sha256sum,
    `#!${process.execPath}\nconst fs=require("node:fs"),crypto=require("node:crypto");const path=process.argv.at(-1),bytes=fs.readFileSync(path);${replaceAfterDigest ? `fs.rmSync(${JSON.stringify(join(dir, 'ogabassey-known-hosts'))},{force:true});fs.symlinkSync(${JSON.stringify(replacement)},${JSON.stringify(join(dir, 'ogabassey-known-hosts'))});` : ''}process.stdout.write(crypto.createHash("sha256").update(bytes).digest("hex")+"  "+path+"\\n");\n`
  );
  await fs.writeFile(
    paths.shasum,
    `#!${process.execPath}\nconst fs=require("node:fs"),crypto=require("node:crypto");const path=process.argv.at(-1);process.stdout.write(crypto.createHash("sha256").update(fs.readFileSync(path)).digest("hex")+"  "+path+"\\n");\n`
  );
  await fs.writeFile(
    paths.uname,
    `#!/bin/bash -p\nprintf '%s\\n' '${platform}'\n`
  );
  for (const path of Object.values(paths)) await fs.chmod(path, 0o755);
  let wrapper = source;
  const replacements = [
    ['readonly SSH_BIN=/usr/bin/ssh', `readonly SSH_BIN=${paths.ssh}`],
    [
      'SSH_KEYGEN_BIN=/usr/bin/ssh-keygen',
      `SSH_KEYGEN_BIN=${paths['ssh-keygen']}`,
    ],
    [
      'LINUX_SHA256_BIN=/usr/bin/sha256sum',
      `LINUX_SHA256_BIN=${paths.sha256sum}`,
    ],
    [
      'DARWIN_SHA256_BIN=/usr/bin/shasum',
      `DARWIN_SHA256_BIN=${paths.shasum}`,
    ],
    ['UNAME_BIN=/usr/bin/uname', `UNAME_BIN=${paths.uname}`],
  ];
  for (const [from, to] of replacements) wrapper = wrapper.replace(from, to);
  for (const path of [
    paths.ssh,
    paths['ssh-keygen'],
    paths.sha256sum,
  ])
    assert.ok(wrapper.includes(path));
  const wrapperPath = join(dir, 'vps-ssh.sh');
  await fs.writeFile(wrapperPath, wrapper);
  await fs.chmod(wrapperPath, 0o755);
  return {
    capture,
    dir,
    hostsPath: join(dir, 'ogabassey-known-hosts'),
    knownHostsCapture,
    replacement,
    wrapperPath,
  };
}
function run(fix, args, options = {}) {
  return exec('/bin/bash', ['-p', fix.wrapperPath, ...args], {
    env: {
      ...process.env,
      CAPTURE: fix.capture,
      HOME: '/hostile-home',
      GIT_SSH_COMMAND: 'ssh -o ProxyCommand=evil',
      PATH: '/hostile-path',
      BASH_ENV: join(fix.dir, 'hostile-bash-env'),
      CWV_TEST_OS: options.platform ?? 'Linux',
      KNOWN_HOSTS_CAPTURE: fix.knownHostsCapture,
      RACE_HOSTS: fix.hostsPath,
      RACE_REPLACEMENT: fix.replacement,
      ...options.env,
    },
    input: options.input,
  });
}
function runWithWritablePreseed(fix, path) {
  return exec('/bin/bash', ['-p', '-c', 'exec 9<>"$1"; rm -f "$1"; export CWV_KNOWN_HOSTS_READY=1 CWV_KNOWN_HOSTS_FD=9; exec "$2" -- id', '--', path, fix.wrapperPath], {
    env: { ...process.env, CAPTURE: fix.capture, CWV_TEST_OS: 'Linux' },
  });
}
const argv = async (fix) =>
  (await fs.readFile(fix.capture, 'utf8')).trimEnd().split('\n');
test('pins the exact one-row host authority with executable repository mode', async () => {
  assert.equal(
    (await fs.lstat(new URL('./vps-ssh.sh', root))).mode & 0o777,
    0o755
  );
  assert.equal(
    hosts,
    '82.29.190.219 ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIMQU7lcSgUHypgyEvjqyQgE6Wh4716Z5ODHkKM/udBvB\n'
  );
  const hash = createHash('sha256').update(hosts).digest('hex');
  assert.equal(
    hash,
    'd73d074536e1beaf206f23994fe01d6116d8e3cfdd8b759be450d8f781567d66'
  );
});
test('uses a fixed privileged Bash that ignores hostile PATH and BASH_ENV', async () => {
  const fix = await fixture();
  const hostile = join(fix.dir, 'hostile-bash-env');
  await fs.writeFile(
    hostile,
    `printf poisoned > "${join(fix.dir, 'poisoned')}"\n`
  );
  await run(fix, ['--', 'id']);
  await assert.rejects(fs.readFile(join(fix.dir, 'poisoned'), 'utf8'));
  assert.match(source, /^#!\/bin\/bash -p$/m);
});
test('runs directly on Darwin through closed macOS tools without changing the Linux remote argv', async () => {
  const fix = await fixture({ platform: 'Darwin' });
  await exec(fix.wrapperPath, ['--', 'id'], {
    env: { ...process.env, CAPTURE: fix.capture },
  });
  assert.equal((await argv(fix)).at(-1), 'id');
  assert.match(source, /Darwin\\n/);
  assert.match(source, /DARWIN_SHA256_BIN=\/usr\/bin\/shasum/);
});
test('freezes complete hostile-config-independent SSH argv', async () => {
  const fix = await fixture();
  await run(fix, ['--tty', '--', 'printf ok']);
  const actual = await argv(fix);
  const knownHosts = actual.find((value) => value.startsWith('KnownHostsCommand=')); assert.equal(knownHosts, `KnownHostsCommand=/bin/echo '${hosts.trim()}'`);
  actual[actual.indexOf(knownHosts)] = 'KnownHostsCommand=<validated-authority>';
  assert.deepEqual(actual, [
    '-F',
    '/dev/null',
    '-tt',
    '-o', 'BatchMode=yes', '-o', 'ServerAliveInterval=15',
    '-o', 'ServerAliveCountMax=12', '-o', 'TCPKeepAlive=yes', '-o',
    'IdentitiesOnly=yes',
    '-o',
    'HostKeyAlgorithms=ssh-ed25519',
    '-o',
    'StrictHostKeyChecking=yes',
    '-o',
    'CheckHostIP=yes',
    '-o',
    'GlobalKnownHostsFile=none',
    '-o',
    'UserKnownHostsFile=none',
    '-o',
    'KnownHostsCommand=<validated-authority>',
    '-o',
    'ProxyCommand=none',
    '-o',
    'ProxyJump=none',
    '-o',
    'PermitLocalCommand=no',
    '-o',
    'ClearAllForwardings=yes',
    '-o',
    'ForwardAgent=no',
    '-o',
    'ForwardX11=no',
    '-o',
    'ControlMaster=no',
    '-o',
    'ControlPath=none',
    '-o',
    'ControlPersist=no',
    '-o',
    'IdentityAgent=none',
    '-o',
    'Tunnel=no',
    '-p',
    '22',
    'bassey@82.29.190.219',
    'printf ok',
  ]);
});
test('allows only an explicit command or stdin transport', async () => {
  const command = await fixture();
  await run(command, ['--', 'id']);
  assert.equal((await argv(command)).at(-1), 'id');
  const stdin = await fixture();
  await run(stdin, ['--'], { input: 'id\n' });
  assert.equal((await argv(stdin)).at(-1), 'bassey@82.29.190.219');
  for (const args of [
    [],
    ['--tty'],
    ['--', 'id', 'extra'],
    ['--', ''],
    ['--proxy', '--', 'id'],
  ]) {
    const rejected = await fixture();
    await assert.rejects(
      run(rejected, args),
      /SSH authority verification failed/
    );
  }
});
test('refuses writable, symlinked, byte-drifted, and fingerprint-drifted authority', async () => {
  const writable = await fixture();
  await fs.chmod(writable.hostsPath, 0o666);
  await assert.rejects(
    run(writable, ['--', 'id']),
    /SSH authority verification failed/
  );
  const altered = await fixture();
  await fs.writeFile(altered.hostsPath, `${hosts}extra\n`);
  await assert.rejects(
    run(altered, ['--', 'id']),
    /SSH authority verification failed/
  );
  const link = await fixture();
  await fs.rename(link.hostsPath, `${link.hostsPath}.real`);
  await fs.symlink(`${link.hostsPath}.real`, link.hostsPath);
  await assert.rejects(
    run(link, ['--', 'id']),
    /SSH authority verification failed/
  );
  const wrong = await fixture({ badFingerprint: true });
  await assert.rejects(
    run(wrong, ['--', 'id']),
    /SSH authority verification failed/
  );
});
test('passes only validated authority bytes to SSH after a pathname replacement race', async () => {
  const fix = await fixture({ replaceAfterDigest: true });
  await run(fix, ['--', 'id']);
  const command = await fs.readFile(fix.knownHostsCapture, 'utf8'); assert.equal(command, `/bin/echo '${hosts.trim()}'`);
  assert.equal((await exec('/bin/sh', ['-c', command])).stdout, hosts);
});
test('rejects a caller-preseeded writable descriptor even when its authority bytes match', async () => {
  const fix = await fixture();
  const preseed = join(fix.dir, 'preseed-known-hosts');
  await fs.writeFile(preseed, hosts);
  await fs.chmod(preseed, 0o600);
  await assert.rejects(
    runWithWritablePreseed(fix, preseed),
    /SSH authority verification failed/
  );
});
test('runs both Perl helpers without caller PERL5OPT or PERL5LIB startup hooks', async () => {
  const fix = await fixture();
  const marker = join(fix.dir, 'perl-startup-ran');
  await fs.writeFile(join(fix.dir, 'Hostile.pm'), `BEGIN { open my $f, '>', ${JSON.stringify(marker)}; print $f 'ran'; } 1;\n`);
  await run(fix, ['--', 'id'], {
    env: { PERL5LIB: fix.dir, PERL5OPT: '-MHostile' },
  });
  await assert.rejects(fs.readFile(marker, 'utf8'));
});
test('contains no mutable SSH authority or caller-selected transport surface', () => {
  for (const token of [
    '"-F", "/dev/null"',
    'HostKeyAlgorithms=ssh-ed25519',
    'StrictHostKeyChecking=yes',
    'GlobalKnownHostsFile=none',
    'UserKnownHostsFile=none',
    'KnownHostsCommand=',
    'ProxyCommand=none',
    'ProxyJump=none',
    'ClearAllForwardings=yes',
    'ControlMaster=no',
    'ForwardAgent=no',
    'Tunnel=no',
    'bassey\\@82.29.190.219',
  ])
    assert.match(
      source,
      new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    );
  assert.doesNotMatch(
    source,
    /process\.env|GIT_SSH_COMMAND|\$\{?(?:HOME|USER|HOST|PORT)\b/
  );
  assert.doesNotMatch(source, /(?:^|[;\n])\s*(?:\/usr\/bin\/)?ssh(?:\s|$)/m);
});
