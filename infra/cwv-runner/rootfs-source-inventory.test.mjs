import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';
import {
  parseRootfsSourceInventory,
  serializeRootfsSourceInventory,
} from './rootfs-source-inventory.mjs';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('binds source paths and metadata to pinned deb and tarball digests', () => {
  const root = mkdtempSync(join(tmpdir(), 'rootfs-source-inventory-'));
  const debSha = 'a'.repeat(64);
  const tarSha = 'b'.repeat(64);
  try {
    mkdirSync(join(root, 'usr/bin'), { recursive: true });
    mkdirSync(join(root, 'opt/runner'), { recursive: true });
    writeFileSync(join(root, 'usr/bin/tool'), 'tool');
    chmodSync(join(root, 'usr/bin/tool'), 0o555);
    symlinkSync('/usr/bin/tool', join(root, 'opt/runner/tool'));

    const bytes = serializeRootfsSourceInventory(
      Buffer.from(
        `deb\ttools\t${debSha}\tusr/bin/tool\n` +
          `tarball\trunner\t${tarSha}\topt/runner/tool`
      ),
      root
    );
    const rows = parseRootfsSourceInventory(bytes, {
      artifactSources: new Map([['runner', tarSha]]),
      baseImageSha256: 'c'.repeat(64),
      packageSources: new Map([['tools', debSha]]),
    });

    assert.deepEqual(
      {
        mode: rows.get('usr/bin/tool').mode,
        sha256: rows.get('usr/bin/tool').sha256,
        type: rows.get('usr/bin/tool').type,
      },
      { mode: '0555', sha256: sha256('tool'), type: '0' }
    );
    assert.equal(rows.get('opt/runner/tool').type, '2');
    assert.equal(rows.get('opt/runner/tool').sha256, sha256('/usr/bin/tool'));

    const changed = JSON.parse(bytes);
    changed.entries[0].sourceSha256 = 'd'.repeat(64);
    assert.throws(
      () =>
        parseRootfsSourceInventory(Buffer.from(canonicalJson(changed)), {
          artifactSources: new Map([['runner', tarSha]]),
          baseImageSha256: 'c'.repeat(64),
          packageSources: new Map([['tools', debSha]]),
        }),
      /unbound rootfs source inventory/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('serializes source rows with direct code-point path ordering', () => {
  const root = mkdtempSync(join(tmpdir(), 'rootfs-source-order-'));
  try {
    mkdirSync(join(root, 'usr/bin'), { recursive: true });
    writeFileSync(join(root, 'usr/bin/A'), 'upper');
    writeFileSync(join(root, 'usr/bin/a'), 'lower');
    const source = 'a'.repeat(64);
    const bytes = serializeRootfsSourceInventory(
      Buffer.from(
        `deb\ttools\t${source}\tusr/bin/a\n` +
          `deb\ttools\t${source}\tusr/bin/A\n`
      ),
      root
    );
    assert.deepEqual(
      JSON.parse(bytes).entries.map((entry) => entry.path),
      ['usr/bin/A', 'usr/bin/a']
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('CLI rejects a seventh argv entry instead of ignoring it', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'rootfs-source-cli-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const candidate = join(root, 'candidate.tsv');
  const output = join(root, 'receipt.json');
  writeFileSync(join(root, 'member'), 'member');
  writeFileSync(candidate, `base-image\tbase\t${'a'.repeat(64)}\tmember\n`);
  const result = spawnSync(process.execPath, [
    fileURLToPath(new URL('rootfs-source-inventory.mjs', import.meta.url)),
    'write',
    candidate,
    output,
    root,
    'ignored',
  ]);
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(output), false);
});
