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

import { canonicalJson } from './canonical-json.mjs';
import { readTask9PrMetadata } from './task9-pr-metadata.mjs';

const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');

test('reads canonical preserved PR metadata bound by its bare digest', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-pr-metadata-'));
  try {
    chmodSync(root, 0o700);
    const value = {
      baseSha: 'a'.repeat(40),
      headRef: 'codex/task9',
      number: 3302,
      reviewedHeadSha: 'b'.repeat(40),
    };
    const bytes = Buffer.from(canonicalJson(value));
    const path = join(root, 'metadata.json');
    const digest = join(root, 'metadata.sha256');
    writeFileSync(path, bytes, { mode: 0o600 });
    writeFileSync(digest, `${hash(bytes)}\n`, { mode: 0o600 });
    assert.deepEqual(readTask9PrMetadata(path, digest), value);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

test('rejects a noncanonical, mismatched, or no-op preserved PR record', () => {
  const root = mkdtempSync(join(tmpdir(), 'task9-pr-metadata-invalid-'));
  try {
    chmodSync(root, 0o700);
    const path = join(root, 'metadata.json');
    const digest = join(root, 'metadata.sha256');
    const value = {
      baseSha: 'a'.repeat(40),
      headRef: 'codex/task9',
      number: 3302,
      reviewedHeadSha: 'b'.repeat(40),
    };
    const bytes = Buffer.from(canonicalJson(value));
    writeFileSync(path, bytes, { mode: 0o600 });
    writeFileSync(digest, `${'0'.repeat(64)}\n`, { mode: 0o600 });
    assert.throws(
      () => readTask9PrMetadata(path, digest),
      /preserved PR metadata/
    );
    writeFileSync(digest, `${hash(bytes)}\n`);
    writeFileSync(path, Buffer.from(JSON.stringify(value, null, 2)));
    writeFileSync(digest, `${hash(readFileSync(path))}\n`);
    assert.throws(
      () => readTask9PrMetadata(path, digest),
      /preserved PR metadata/
    );
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});
