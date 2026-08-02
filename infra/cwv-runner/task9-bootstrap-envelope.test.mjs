import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  authorizeTask9Bundle,
  BUNDLE_ENTRIES,
  canonicalJson,
  readBundleFiles,
} from './task9-bootstrap.mjs';
import { createExactBootstrapBundle } from './task9-bootstrap-runtime-fixture.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const owner = process.getuid();

test('review envelope binds the exact seven payload rows and both source projections', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-envelope-'));
  try {
    const value = createExactBootstrapBundle(root);
    const envelopeBytes = readFileSync(value.envelopePath);
    const envelope = JSON.parse(envelopeBytes);
    assert.deepEqual(
      envelope.payload.entries,
      [...BUNDLE_ENTRIES].sort().map((name) => ({
        mode: name === 'node' ? '100500' : '100400',
        path: `payload/${name}`,
        sha256: hash(readFileSync(join(value.bundleDir, name))),
        type: 'file',
      }))
    );
    assert.deepEqual(envelope.source, {
      archiveSha256: hash(readFileSync(join(value.bundleDir, 'source.tar'))),
      manifestSha256: hash(
        readFileSync(join(value.bundleDir, 'manifest.json'))
      ),
    });
    assert.equal(
      envelope.runtime.launcherSha256,
      hash(readFileSync(value.launcher))
    );
    assert.equal(value.launcherSha256, envelope.runtime.launcherSha256);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('rejects changed source bytes against the reviewed envelope before tar parsing', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-envelope-order-'));
  try {
    const value = createExactBootstrapBundle(root);
    const sourcePath = join(value.bundleDir, 'source.tar');
    const digestPath = join(value.bundleDir, 'source.tar.sha256');
    const changed = Buffer.from('not a tar archive');
    chmodSync(sourcePath, 0o600);
    chmodSync(digestPath, 0o600);
    writeFileSync(sourcePath, changed, { mode: 0o400 });
    writeFileSync(digestPath, `${hash(changed)}  source.tar\n`, {
      mode: 0o400,
    });
    chmodSync(sourcePath, 0o400);
    chmodSync(digestPath, 0o400);
    const envelopeBytes = readFileSync(value.envelopePath);
    assert.throws(
      () =>
        authorizeTask9Bundle({
          bundleId: value.bundleId,
          envelopeBytes,
          envelopeSha256: value.envelopeSha256,
          files: readBundleFiles(value.bundleDir, owner),
          owner,
          reviewedEnvelopeSha256: value.envelopeSha256,
        }),
      /reviewed payload/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('a replacement envelope and matching detached digest cannot replace the reviewed literal', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-envelope-review-'));
  try {
    const value = createExactBootstrapBundle(root);
    const original = value.envelopeSha256;
    const envelope = JSON.parse(readFileSync(value.envelopePath));
    envelope.bundleId = 'attacker-selected';
    const replacement = Buffer.from(canonicalJson(envelope));
    assert.throws(
      () =>
        authorizeTask9Bundle({
          bundleId: envelope.bundleId,
          envelopeBytes: replacement,
          envelopeSha256: hash(replacement),
          files: readBundleFiles(value.bundleDir, owner),
          owner,
          reviewedEnvelopeSha256: original,
        }),
      /envelope digest/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
