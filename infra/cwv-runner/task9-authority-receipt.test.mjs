import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { canonicalJson } from './canonical-json.mjs';
import { readTask9AuthorityReceipt } from './task9-authority-receipt.mjs';

const sha = 'a'.repeat(40);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
function writeReceipt(value) {
  const root = mkdtempSync(join(tmpdir(), 'task9-receipt-test-'));
  const bytes = Buffer.from(canonicalJson(value));
  const path = join(root, 'receipt.json');
  const digestPath = join(root, 'receipt.sha256');
  writeFileSync(path, bytes, { mode: 0o600 });
  writeFileSync(digestPath, `${digest(bytes)}\n`, { mode: 0o600 });
  chmodSync(path, 0o600); chmodSync(digestPath, 0o600);
  return { root, path, digestPath, digest: digest(bytes) };
}
const valid = () => ({
  coherence: 'success', deploymentSha: sha, metadataSha256: 'b'.repeat(64),
  repository: { id: 1, name: 'ogabasseyy/Baci' }, status: 'success',
  workflow: { id: 2, path: '.github/workflows/deploy.yml', sha },
});

test('parses a canonical successful authority receipt', () => {
  const fixture = writeReceipt(valid());
  try { assert.equal(readTask9AuthorityReceipt(fixture.path, fixture.digestPath, fixture.digest).repository.id, 1); }
  finally { rmSync(fixture.root, { recursive: true, force: true }); }
});

test('rejects failed, wrong-workflow, and malformed-repository receipts', () => {
  for (const mutate of [
    (v) => ({ ...v, status: 'failure' }),
    (v) => ({ ...v, workflow: { ...v.workflow, path: '.github/workflows/other.yml' } }),
    (v) => ({ ...v, repository: { id: 0, name: 'fork/Baci' } }),
  ]) {
    const fixture = writeReceipt(mutate(valid()));
    try { assert.throws(() => readTask9AuthorityReceipt(fixture.path, fixture.digestPath, fixture.digest), /invalid Task 9 authority receipt/); }
    finally { rmSync(fixture.root, { recursive: true, force: true }); }
  }
});
