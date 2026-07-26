import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  generatedTrustSourcePaths,
  rootfsSourceMembershipInput,
  verifyGeneratedTrustBundle,
} from './rootfs-source-membership-input.mjs';
import { serializeRootfsSourceMembership } from './rootfs-source-membership-write.mjs';

const digest = 'a'.repeat(64);
const packageRow = {
  architecture: 'amd64',
  filename: 'pool/main/g/git/git_1_amd64.deb',
  name: 'git',
  sha256: digest,
  version: '1',
};
const ubuntu = { packages: [packageRow] };
const candidates = (rows) => Buffer.from(rows.join('\n'));
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const tarEntry = (name, value = '') => {
  const header = Buffer.alloc(512);
  header.write(name);
  header.write('0000555\0', 100);
  header.write('0000000\0', 108);
  header.write('0000000\0', 116);
  header.write(`${value.length.toString(8).padStart(11, '0')}\0`, 124);
  header[156] = 48;
  header.write('ustar\0', 257);
  header.fill(32, 148, 156);
  header.write(
    `${[...header]
      .reduce((sum, byte) => sum + byte, 0)
      .toString(8)
      .padStart(6, '0')}\0 `,
    148
  );
  return Buffer.concat([
    header,
    Buffer.from(value),
    Buffer.alloc((512 - (value.length % 512)) % 512),
  ]);
};
const tar = (entries) =>
  Buffer.concat([
    ...entries.map(([name, value]) => tarEntry(name, value)),
    Buffer.alloc(1024),
  ]);

test('groups only pinned package/archive candidates into canonical membership inputs', () => {
  const bytes = rootfsSourceMembershipInput(
    candidates([
      `deb\tgit\t${digest}\tusr/bin/git`,
      `deb\tgit\t${digest}\tusr/lib/git-core/git-remote-https`,
    ]),
    ubuntu,
    {},
    '/verified/debs'
  );
  assert.deepEqual(JSON.parse(bytes), {
    schemaVersion: 1,
    sources: [
      {
        archivePath: `/verified/debs/${digest}.tar`,
        candidates: ['usr/bin/git', 'usr/lib/git-core/git-remote-https'],
        installPrefix: '',
        kind: 'deb',
        owner: 'git',
        source: packageRow,
        sourceArchivePath: `/verified/debs/${digest}.deb`,
        stripComponents: 0,
      },
    ],
  });
});

test('derives the generated trust bundle from sorted source-bound certificate members only', () => {
  const projection = new Map([
    [
      'usr/share/ca-certificates/mozilla/Z.crt',
      {
        kind: 'package',
        owner: 'ca-certificates',
        path: 'usr/share/ca-certificates/mozilla/Z.crt',
      },
    ],
    [
      'usr/share/ca-certificates/mozilla/A.crt',
      {
        kind: 'package',
        owner: 'ca-certificates',
        path: 'usr/share/ca-certificates/mozilla/A.crt',
      },
    ],
    [
      'usr/share/ca-certificates/mozilla/Disabled.crt',
      {
        kind: 'package',
        owner: 'ca-certificates',
        path: 'usr/share/ca-certificates/mozilla/Disabled.crt',
      },
    ],
    [
      'etc/ca-certificates.conf',
      {
        kind: 'package',
        owner: 'ca-certificates',
        path: 'etc/ca-certificates.conf',
      },
    ],
  ]);
  assert.deepEqual(
    generatedTrustSourcePaths(
      projection,
      Buffer.from('mozilla/Z.crt\n!mozilla/Disabled.crt\nmozilla/A.crt\n')
    ),
    [
      'usr/share/ca-certificates/mozilla/A.crt',
      'usr/share/ca-certificates/mozilla/Z.crt',
    ]
  );
  const certificates = new Map([
    ['usr/share/ca-certificates/mozilla/A.crt', Buffer.from('A')],
    ['usr/share/ca-certificates/mozilla/Z.crt', Buffer.from('Z')],
  ]);
  assert.deepEqual(
    verifyGeneratedTrustBundle(
      projection,
      Buffer.from('mozilla/Z.crt\nmozilla/A.crt\n'),
      (path) => certificates.get(path),
      sha256('AZ')
    ),
    [
      'usr/share/ca-certificates/mozilla/A.crt',
      'usr/share/ca-certificates/mozilla/Z.crt',
    ]
  );
  assert.throws(
    () =>
      verifyGeneratedTrustBundle(
        projection,
        Buffer.from('mozilla/Z.crt\nmozilla/A.crt\n'),
        (path) => certificates.get(path),
        digest
      ),
    /generated trust bundle source mismatch/
  );
  assert.throws(
    () => generatedTrustSourcePaths(new Map(), Buffer.from('mozilla/A.crt\n')),
    /missing generated trust sources/
  );
  assert.throws(
    () => generatedTrustSourcePaths(projection, Buffer.from('../escape.crt\n')),
    /invalid generated trust source/
  );
});

test('records the exact vendor-tar installation transform', () => {
  const bytes = rootfsSourceMembershipInput(
    candidates([`tarball\trunner\t${digest}\topt/runner/bin/Runner.Listener`]),
    ubuntu,
    {
      runner: {
        archivePath: '/runner.tar',
        installPrefix: 'opt/runner',
        kind: 'tarball',
        source: { sha256: digest },
        sourceArchivePath: '/runner.tar.gz',
        stripComponents: 0,
      },
    },
    '/debs'
  );
  assert.deepEqual(JSON.parse(bytes).sources[0], {
    archivePath: '/runner.tar',
    candidates: ['opt/runner/bin/Runner.Listener'],
    installPrefix: 'opt/runner',
    kind: 'tarball',
    owner: 'runner',
    source: { sha256: digest },
    sourceArchivePath: '/runner.tar.gz',
    stripComponents: 0,
  });
});

test('rejects source identity substitution and base-image fallback', () => {
  for (const rows of [
    [`deb\tgit\t${'b'.repeat(64)}\tusr/bin/git`],
    [`base-image\tbase\t${digest}\tlib/x86_64-linux-gnu/libc.so.6`],
  ])
    assert.throws(
      () => rootfsSourceMembershipInput(candidates(rows), ubuntu, {}, '/debs'),
      /(?:unbound|invalid) rootfs source candidate/
    );
});

test('requires Chrome-like external debs to carry complete package identity', () => {
  assert.throws(
    () =>
      rootfsSourceMembershipInput(
        candidates([
          `deb\tgoogle-chrome-stable\t${digest}\topt/google/chrome/chrome`,
        ]),
        ubuntu,
        {
          'google-chrome-stable': {
            archivePath: '/chrome.tar',
            kind: 'deb',
            source: { sha256: digest },
            sourceArchivePath: '/chrome.deb',
          },
        },
        '/debs'
      ),
    /invalid rootfs artifact source/
  );
});

test('maps stripped vendor members to installed paths above the outer archive cap', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'rootfs-source-strip-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const archive = join(root, 'node.tar');
  const rows = Array.from({ length: 257 }, (_value, index) => [
    `node-root/bin/tool-${index}`,
    `tool-${index}`,
  ]);
  const bytes = tar(rows);
  writeFileSync(archive, bytes);
  const receipt = JSON.parse(
    serializeRootfsSourceMembership({
      schemaVersion: 1,
      sources: [
        {
          archivePath: archive,
          candidates: rows
            .map((_row, index) => `opt/node/bin/tool-${index}`)
            .sort(),
          installPrefix: 'opt/node',
          kind: 'tarball',
          owner: 'node',
          source: { sha256: sha256(bytes) },
          sourceArchivePath: archive,
          stripComponents: 1,
        },
      ],
    })
  );
  assert.equal(receipt.sources[0].entries.length, 257);
  assert.deepEqual(receipt.sources[0].entries[0], {
    gid: 0,
    linkTarget: null,
    mode: '0555',
    path: 'opt/node/bin/tool-0',
    sha256: sha256('tool-0'),
    sourcePath: 'node-root/bin/tool-0',
    type: '0',
    uid: 0,
  });
});
