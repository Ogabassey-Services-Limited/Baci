import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { canonicalJson } from './canonical-json.mjs';
import { parseRootfsSourceInventory } from './rootfs-source-inventory.mjs';
import {
  packageSourceAuthority,
  parseRootfsSourceMembership,
} from './rootfs-source-membership.mjs';
import { serializeRootfsSourceMembership } from './rootfs-source-membership-write.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const deb = {
  architecture: 'amd64',
  filename: 'pool/main/g/git/git_1_amd64.deb',
  name: 'git',
  sha256: 'a'.repeat(64),
  version: '1',
};
const file = (path, value = 'git') => ({
  gid: 0,
  linkTarget: null,
  mode: '0555',
  path,
  sha256: sha256(value),
  type: '0',
  uid: 0,
});
const member = (entry, sourcePath = entry.path) => ({ ...entry, sourcePath });
const authority = (runnerSha = 'b'.repeat(64)) => ({
  artifactSources: new Map([['runner', runnerSha]]),
  packageSources: new Map([['git', deb]]),
});
const membership = (entries = [file('usr/bin/git')]) =>
  Buffer.from(
    canonicalJson({
      schemaVersion: 1,
      sources: [
        {
          entries: entries.map((entry) => member(entry)),
          installPrefix: '',
          kind: 'deb',
          owner: 'git',
          source: deb,
          stripComponents: 0,
        },
      ],
    })
  );
const inventory = (entries) =>
  Buffer.from(canonicalJson({ entries, schemaVersion: 1 }));
const inventoryRow = (path, value = 'git') => {
  return {
    ...file(path, value),
    kind: 'deb',
    owner: 'git',
    sourceSha256: deb.sha256,
  };
};
const octal = (header, offset, width, value) =>
  header.write(
    `${value.toString(8).padStart(width - 1, '0')}\0`,
    offset,
    width
  );
const tar = (name, value) => {
  const header = Buffer.alloc(512);
  header.write(name);
  octal(header, 100, 8, 0o555);
  octal(header, 108, 8, 0);
  octal(header, 116, 8, 0);
  octal(header, 124, 12, value.length);
  header[156] = 48;
  header.write('ustar\0', 257);
  header.fill(32, 148, 156);
  const checksum = [...header].reduce((total, byte) => total + byte, 0);
  header.write(`${checksum.toString(8).padStart(6, '0')}\0 `, 148);
  return Buffer.concat([
    header,
    Buffer.from(value),
    Buffer.alloc((512 - (value.length % 512)) % 512),
    Buffer.alloc(1024),
  ]);
};

test('binds copied package members to exact archive-member identity', () => {
  const members = parseRootfsSourceMembership(membership(), authority());
  assert.doesNotThrow(() =>
    parseRootfsSourceInventory(inventory([inventoryRow('usr/bin/git')]), {
      ...authority(),
      membership: members,
    })
  );
  for (const changed of [
    inventoryRow('usr/bin/git', 'replaced'),
    { ...inventoryRow('usr/bin/git'), mode: '0755' },
    { ...inventoryRow('usr/bin/git'), uid: 1 },
  ])
    assert.throws(
      () =>
        parseRootfsSourceInventory(inventory([changed]), {
          ...authority(),
          membership: members,
        }),
      /membership mismatch/
    );
});

test('binds symlink destination identity instead of only its target hash claim', () => {
  const target = '/usr/lib/x86_64-linux-gnu/libgit.so';
  const entry = {
    ...file('usr/lib/x86_64-linux-gnu/libgit.so.1'),
    linkTarget: target,
    sha256: sha256(target),
    type: '2',
  };
  const members = parseRootfsSourceMembership(membership([entry]), authority());
  assert.throws(
    () =>
      parseRootfsSourceInventory(
        inventory([
          {
            ...entry,
            kind: 'deb',
            linkTarget: '/usr/lib/x86_64-linux-gnu/libgit-injected.so',
            owner: 'git',
            sha256: sha256('/usr/lib/x86_64-linux-gnu/libgit-injected.so'),
            sourceSha256: deb.sha256,
          },
        ]),
        { ...authority(), membership: members }
      ),
    /membership mismatch/
  );
});

test('rejects a co-tampered projection inventory fake library absent from the pinned deb', () => {
  const members = parseRootfsSourceMembership(membership(), authority());
  assert.throws(
    () =>
      parseRootfsSourceInventory(
        inventory([
          inventoryRow('usr/bin/git'),
          inventoryRow('usr/lib/x86_64-linux-gnu/libgit-fake.so', 'fake'),
        ]),
        { ...authority(), membership: members }
      ),
    /membership mismatch/
  );
});

test('rejects an injected runner entrypoint falsely attributed to the runner tarball', () => {
  const runner = {
    entries: [member(file('opt/runner/bin/Runner.Listener', 'listener'))],
    installPrefix: '',
    kind: 'tarball',
    owner: 'runner',
    source: { sha256: 'b'.repeat(64) },
    stripComponents: 0,
  };
  const members = parseRootfsSourceMembership(
    Buffer.from(canonicalJson({ schemaVersion: 1, sources: [runner] })),
    authority()
  );
  const row = {
    ...file('opt/runner/entrypoint.mjs', 'injected'),
    kind: 'tarball',
    owner: 'runner',
    sourceSha256: runner.source.sha256,
  };
  assert.throws(
    () =>
      parseRootfsSourceInventory(inventory([row]), {
        ...authority(),
        membership: members,
      }),
    /membership mismatch/
  );
});

test('requires the complete unique Ubuntu package identity, not only its name and digest', () => {
  for (const changed of [
    { ...deb, version: '2' },
    { ...deb, filename: 'pool/invented.deb' },
  ])
    assert.throws(
      () =>
        parseRootfsSourceMembership(
          Buffer.from(
            canonicalJson({
              schemaVersion: 1,
              sources: [
                {
                  entries: [member(file('usr/bin/git'))],
                  installPrefix: '',
                  kind: 'deb',
                  owner: 'git',
                  source: changed,
                  stripComponents: 0,
                },
              ],
            })
          ),
          authority()
        ),
      /unbound rootfs source membership source/
    );
});

test('refuses duplicate nested Ubuntu package names before a map can overwrite one', () => {
  assert.throws(
    () => packageSourceAuthority([deb, { ...deb, version: '2' }]),
    /invalid Ubuntu package authority/
  );
});

test('refuses base-image fallback when archive-backed membership is enforced', () => {
  const members = parseRootfsSourceMembership(membership(), authority());
  const row = {
    ...file('lib/x86_64-linux-gnu/libc.so.6', 'libc'),
    kind: 'base-image',
    owner: 'base',
    sourceSha256: 'c'.repeat(64),
  };
  assert.throws(
    () =>
      parseRootfsSourceInventory(inventory([row]), {
        ...authority(),
        baseImageSha256: row.sourceSha256,
        membership: members,
      }),
    /unproven base-image rootfs source row/
  );
});

test('derives membership hashes from the pinned raw source archive', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'rootfs-source-membership-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const archive = join(root, 'runner.tar');
  const bytes = tar('bin/Runner.Listener', 'listener');
  writeFileSync(archive, bytes);
  const receipt = serializeRootfsSourceMembership({
    schemaVersion: 1,
    sources: [
      {
        archivePath: archive,
        candidates: ['opt/runner/bin/Runner.Listener'],
        installPrefix: 'opt/runner',
        kind: 'tarball',
        owner: 'runner',
        source: { sha256: sha256(bytes) },
        sourceArchivePath: archive,
        stripComponents: 0,
      },
    ],
  });
  const members = parseRootfsSourceMembership(
    receipt,
    authority(sha256(bytes))
  );
  assert.equal(
    members.get(
      `tarball\0runner\0${sha256(bytes)}\0opt/runner/bin/Runner.Listener`
    ).sha256,
    sha256('listener')
  );
  assert.throws(
    () =>
      serializeRootfsSourceMembership({
        schemaVersion: 1,
        sources: [
          {
            archivePath: archive,
            candidates: ['opt/runner/bin/Runner.Listener'],
            installPrefix: 'opt/runner',
            kind: 'tarball',
            owner: 'runner',
            source: { sha256: '0'.repeat(64) },
            sourceArchivePath: archive,
            stripComponents: 0,
          },
        ],
      }),
    /rootfs source archive digest mismatch/
  );
});
