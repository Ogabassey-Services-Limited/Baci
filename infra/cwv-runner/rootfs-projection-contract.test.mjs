import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { canonicalJson } from './canonical-json.mjs';
import * as rootfs from './rootfs-projection-contract.mjs';

const requiredEntries = [
  { kind: 'closure', owner: 'shell', path: 'bin/dash' },
  { kind: 'closure', owner: 'shell', path: 'bin/sh' },
  { kind: 'generated', owner: 'identity', path: 'etc/group' },
  { kind: 'generated', owner: 'identity', path: 'etc/passwd' },
  { kind: 'generated', owner: 'awk-alternative', path: 'etc/alternatives/awk' },
  {
    kind: 'generated',
    owner: 'trust',
    path: 'etc/ssl/certs/ca-certificates.crt',
  },
  { kind: 'generated', owner: 'directory', path: 'home/runner' },
  {
    kind: 'closure',
    owner: 'shell',
    path: 'lib/x86_64-linux-gnu/ld-linux-x86-64.so.2',
  },
  {
    kind: 'closure',
    owner: 'shell',
    path: 'lib64/ld-linux-x86-64.so.2',
  },
  {
    kind: 'artifact',
    owner: 'chrome',
    path: 'opt/google/chrome/chrome',
  },
  { kind: 'artifact', owner: 'node', path: 'opt/node/bin/node' },
  {
    kind: 'artifact',
    owner: 'runner',
    path: 'opt/runner/bin/Runner.Listener',
  },
  {
    kind: 'artifact',
    owner: 'runner',
    path: 'opt/runner/bin/Runner.PluginHost',
  },
  {
    kind: 'artifact',
    owner: 'runner',
    path: 'opt/runner/bin/Runner.Worker',
  },
  {
    kind: 'artifact',
    owner: 'runner',
    path: 'opt/runner/externals/node24/bin/node',
  },
  { kind: 'generated', owner: 'directory', path: 'opt/runner/_diag' },
  {
    kind: 'declared',
    owner: 'baci',
    path: rootfs.rootfsProjectionPath,
  },
  {
    kind: 'generated',
    owner: 'directory',
    path: 'registration-staging',
  },
  { kind: 'generated', owner: 'directory', path: 'runner-work' },
  { kind: 'generated', owner: 'directory', path: 'tmp/baci-cwv' },
  { kind: 'package', owner: 'bash', path: 'usr/bin/bash' },
  { kind: 'closure', owner: 'shell', path: 'usr/bin/dash' },
  { kind: 'package', owner: 'git', path: 'usr/bin/git' },
  {
    kind: 'package',
    owner: 'git',
    path: 'usr/lib/git-core/git-remote-https',
  },
  {
    kind: 'closure',
    owner: 'shell',
    path: 'usr/lib/x86_64-linux-gnu/ld-linux-x86-64.so.2',
  },
  { kind: 'package', owner: 'coreutils', path: 'usr/bin/cat' },
  { kind: 'package', owner: 'coreutils', path: 'usr/bin/id' },
  { kind: 'package', owner: 'coreutils', path: 'usr/bin/stat' },
  { kind: 'package', owner: 'coreutils', path: 'usr/bin/tr' },
  { kind: 'package', owner: 'dpkg', path: 'usr/bin/dpkg-query' },
  { kind: 'package', owner: 'grep', path: 'usr/bin/grep' },
  { kind: 'generated', owner: 'awk-alternative', path: 'usr/bin/awk' },
  { kind: 'package', owner: 'mawk', path: 'usr/bin/mawk' },
  { kind: 'package', owner: 'util-linux', path: 'usr/bin/findmnt' },
  { kind: 'generated', owner: 'dpkg-query', path: 'var/lib/dpkg/status' },
];
const declared = new Set([rootfs.rootfsProjectionPath]);
// biome-ignore format: source records retain one fixed receipt shape.
const sourceRecord = (entry, kind, owner = entry.owner) => ({ kind, owner, path: entry.path, sourceSha256: 'b'.repeat(64) });
const sourceKinds = {
  artifact: 'tarball',
  closure: 'deb',
  package: 'deb',
};
const sourceInventory = new Map(
  requiredEntries
    .filter(({ kind }) => ['artifact', 'closure', 'package'].includes(kind))
    .map((entry) => [
      entry.path,
      entry.owner === 'chrome'
        ? sourceRecord(entry, 'deb', 'google-chrome-stable')
        : sourceRecord(entry, sourceKinds[entry.kind]),
    ])
);
const parse = (bytes, inventory = sourceInventory) =>
  rootfs.parseRootfsProjection(bytes, declared, inventory);
const manifest = (entries = requiredEntries) =>
  Buffer.from(
    canonicalJson({
      entries: [...entries].sort((left, right) =>
        left.path < right.path ? -1 : left.path > right.path ? 1 : 0
      ),
      schemaVersion: 1,
    })
  );
// biome-ignore format: the closed projection acceptance stays compact for the audited file-size gate.
test('accepts the closed scratch runtime state and executable closure', () => { const parsed = parse(manifest()); assert.equal(parsed.size, requiredEntries.length); });
// biome-ignore format: exact identity/trust bytes and modes remain one compact archive-authority matrix.
test('binds minimal generated identity, trust, and awk-link target bytes', () => { const entries = requiredEntries.filter(({ owner }) => ['awk-alternative', 'identity', 'trust'].includes(owner)); const projection = new Map(entries.map((entry) => [entry.path, entry])); const sha256 = (value) => createHash('sha256').update(value).digest('hex'); const rows = new Map([['etc/alternatives/awk', { gid: 0, mode: '0777', path: 'etc/alternatives/awk', sha256: sha256('/usr/bin/mawk'), type: '2', uid: 0 }], ['etc/group', { gid: 0, mode: '0644', path: 'etc/group', sha256: sha256('runner:x:10001:\n'), type: '0', uid: 0 }], ['etc/passwd', { gid: 0, mode: '0644', path: 'etc/passwd', sha256: sha256('runner:x:10001:10001:Baci CWV Runner:/home/runner:/bin/bash\n'), type: '0', uid: 0 }], ['etc/ssl/certs/ca-certificates.crt', { gid: 0, mode: '0444', path: 'etc/ssl/certs/ca-certificates.crt', type: '0', uid: 0 }], ['usr/bin/awk', { gid: 0, mode: '0777', path: 'usr/bin/awk', sha256: sha256('/etc/alternatives/awk'), type: '2', uid: 0 }]]); assert.doesNotThrow(() => rootfs.validateRootfsProjectionInventory(projection, new Map(), rows)); const modeDrift = new Map(rows); modeDrift.set('usr/bin/awk', { ...rows.get('usr/bin/awk'), mode: '0755' }); assert.throws(() => rootfs.validateRootfsProjectionInventory(projection, new Map(), modeDrift), /archive identity mismatch/); const writableTrust = new Map(rows); writableTrust.set('etc/ssl/certs/ca-certificates.crt', { ...rows.get('etc/ssl/certs/ca-certificates.crt'), mode: '0644' }); assert.throws(() => rootfs.validateRootfsProjectionInventory(projection, new Map(), writableTrust), /archive identity mismatch/); rows.set('usr/bin/awk', { ...rows.get('usr/bin/awk'), sha256: sha256('/tmp/injected') }); assert.throws(() => rootfs.validateRootfsProjectionInventory(projection, new Map(), rows), /archive identity mismatch/); });
test('requires every generated state and runtime executable path', () => {
  for (const required of requiredEntries) {
    assert.throws(
      () =>
        parse(manifest(requiredEntries.filter((entry) => entry !== required))),
      /missing required rootfs projection/
    );
  }
});
test('requires the entire executable closure used by the mandatory isolation probe', () => {
  for (const required of requiredEntries.filter(({ path }) =>
    /^usr\/bin\/(?:awk|cat|findmnt|grep|id|stat|tr)$/.test(path)
  ))
    assert.throws(
      () =>
        parse(manifest(requiredEntries.filter((entry) => entry !== required))),
      /missing required rootfs projection/
    );
});
test('admits only the probe role shared-library closure', () => {
  assert.doesNotThrow(() =>
    parse(
      manifest([
        ...requiredEntries,
        {
          kind: 'closure',
          owner: 'isolation-probe',
          path: 'lib/x86_64-linux-gnu/libc.so.6',
        },
      ]),
      new Map([
        ...sourceInventory,
        [
          'lib/x86_64-linux-gnu/libc.so.6',
          sourceRecord(
            { path: 'lib/x86_64-linux-gnu/libc.so.6' },
            'deb',
            'libc6'
          ),
        ],
      ])
    )
  );
});
// biome-ignore format: the runtime-package closure admission is one exact source-bound tuple.
test('admits shared-library closures rooted by every declared runtime package', () => { const path = 'usr/lib/x86_64-linux-gnu/libjq.so.1'; assert.doesNotThrow(() => parse(manifest([...requiredEntries, { kind: 'closure', owner: 'runtime-package-jq', path }]), new Map([...sourceInventory, [path, sourceRecord({ path }, 'deb', 'jq')]]))); });
// biome-ignore format: build-only package roles remain one explicit rejected source-bound tuple.
test('rejects closure roles for undeclared build-only packages', () => { const path = 'usr/lib/x86_64-linux-gnu/libgpgv.so.1'; assert.throws(() => parse(manifest([...requiredEntries, { kind: 'closure', owner: 'runtime-package-gpgv', path }]), new Map([...sourceInventory, [path, sourceRecord({ path }, 'deb', 'gpgv')]])), /undeclared runtime closure path/); });
test('admits only closure dependencies owned by a verified Debian receipt', () => {
  const changed = new Map(sourceInventory);
  const source = sourceRecord({ path: 'bin/sh' }, 'deb', 'dash');
  changed.set('bin/sh', source);
  assert.doesNotThrow(() => parse(manifest(), changed));
  for (const invalid of [
    { ...source, owner: '../dash' },
    { ...source, path: 'usr/bin/dash' },
    { ...source, sourceSha256: 'not-a-digest' },
  ]) {
    changed.set('bin/sh', invalid);
    assert.throws(
      () => parse(manifest(), changed),
      /rootfs source inventory mismatch/
    );
  }
  changed.set('bin/sh', {
    ...sourceInventory.get('bin/sh'),
    path: 'usr/bin/dash',
  });
  assert.throws(
    () => parse(manifest(), changed),
    /rootfs source inventory mismatch/
  );
});
for (const path of [
  'var/lib/dpkg/available',
  'var/lib/dpkg/info/google-chrome-stable.postinst',
  'etc/apt/sources.list.d/google-chrome.list',
  'var/cache/apt/pkgcache.bin',
])
  test(`rejects package-manager state regardless of owner: ${path}`, () => {
    assert.throws(
      () =>
        parse(
          manifest([
            ...requiredEntries,
            { kind: 'package', owner: 'git', path },
          ])
        ),
      /forbidden package-manager runtime path/
    );
  });
test('admits only the exact dpkg-owned query surface', () => {
  assert.throws(
    () =>
      parse(
        manifest([
          ...requiredEntries,
          { kind: 'package', owner: 'dpkg', path: 'usr/bin/dpkg' },
        ])
      ),
    /undeclared dpkg runtime path/
  );
});
test('permits only the exact awk alternative projection closure', () => {
  // biome-ignore format: keep the exact malformed binding compact.
  const alternatives = requiredEntries.map((entry) => entry.path === 'etc/alternatives/awk' ? { ...entry, owner: 'shell' } : entry);
  assert.throws(
    () => parse(manifest(alternatives)),
    /undeclared generated rootfs path/
  );
  assert.throws(
    () =>
      parse(
        manifest([
          ...requiredEntries,
          {
            kind: 'closure',
            owner: 'isolation-probe',
            path: 'etc/alternatives/editor',
          },
        ])
      ),
    /undeclared runtime closure path/
  );
});
test('rejects package ownership under every sealed artifact root', () => {
  for (const [path, owner] of [
    ['opt/google/chrome/chrome', 'google-chrome-stable'],
    ['opt/node/bin/node', 'bash'],
    ['opt/pnpm/bin/pnpm.cjs', 'bash'],
    ['opt/runner/bin/Runner.Listener', 'bash'],
  ]) {
    const changed = requiredEntries.map((entry) =>
      entry.path === path ? { ...entry, kind: 'package', owner } : entry
    );
    if (!requiredEntries.some((entry) => entry.path === path))
      changed.push({ kind: 'package', owner, path });
    assert.throws(() => parse(manifest(changed)), /artifact root/);
  }
});
// biome-ignore format: the two forbidden Chrome source identities are one exact negative matrix.
test('accepts only the exact signed Chrome deb source under its artifact root', () => { for (const changedSource of [sourceRecord(requiredEntries.find(({ owner }) => owner === 'chrome'), 'tarball'), sourceRecord(requiredEntries.find(({ owner }) => owner === 'chrome'), 'deb', 'chrome')]) { const changed = new Map(sourceInventory); changed.set('opt/google/chrome/chrome', changedSource); assert.throws(() => parse(manifest(), changed), /source inventory mismatch/); } });
test('rejects the same path under different owners', () => {
  const duplicate = {
    kind: 'closure',
    owner: 'runtime-node',
    path: 'opt/node/bin/node',
  };
  assert.throws(
    () => parse(manifest([...requiredEntries, duplicate])),
    /duplicate rootfs projection path/
  );
});
test('rejects regenerated projections that self-authorize payloads absent from the source inventory', () => {
  for (const path of [
    'usr/bin/runtime-payload',
    'usr/lib/libruntime-payload.so',
    'etc/cron.d/runtime-payload',
  ])
    assert.throws(
      () =>
        rootfs.parseRootfsProjection(
          manifest([
            ...requiredEntries,
            { kind: 'package', owner: 'git', path },
          ]),
          declared,
          sourceInventory
        ),
      /source inventory/
    );
});
