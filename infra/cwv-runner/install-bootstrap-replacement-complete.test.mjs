import assert from 'node:assert/strict';
import test from 'node:test';

import { completeBootstrapReplacement } from './install-bootstrap-replacement-complete.mjs';

const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const files = {
  [path]: { sha256: '2'.repeat(64), mode: '0600', owner: 'root:root' },
};
const intent = {
  schemaVersion: 1,
  sourceSha: 'b'.repeat(40),
  captureSha256: '6'.repeat(64),
};
const complete = {
  phase: 'complete',
  sourceSha: intent.sourceSha,
  captureSha256: intent.captureSha256,
  receiptSha256: '9'.repeat(64),
  receipt: { files },
};

test('publishes a generation receipt only after the target projection is complete', async () => {
  const persisted = [];
  const receipt = await completeBootstrapReplacement(
    { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
    {
      readState: async () => complete,
      readIntent: async () => intent,
      readProjection: async () => files,
      persistReceipt: async (_directory, value) => persisted.push(value),
    }
  );
  assert.equal(receipt.receiptSha256, complete.receiptSha256);
  assert.deepEqual(persisted, [receipt]);
});

test('refuses captured state without publishing a generation receipt', async () => {
  const persisted = [];

  await assert.rejects(
    completeBootstrapReplacement(
      { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
      {
        readState: async () => ({ ...complete, phase: 'captured' }),
        readIntent: async () => intent,
        readProjection: async () => files,
        persistReceipt: async (_directory, value) => persisted.push(value),
      }
    ),
    /completed replacement projection required/
  );

  assert.deepEqual(persisted, []);
});

test('refuses a mismatched installed projection without publishing a generation receipt', async () => {
  const persisted = [];
  const mismatchedFiles = {
    [path]: { ...files[path], sha256: '3'.repeat(64) },
  };

  await assert.rejects(
    completeBootstrapReplacement(
      { currentDirectory: '/state/bootstrap-bbbbbbbbbbbb' },
      {
        readState: async () => complete,
        readIntent: async () => intent,
        readProjection: async () => mismatchedFiles,
        persistReceipt: async (_directory, value) => persisted.push(value),
      }
    ),
    /completed replacement projection required/
  );

  assert.deepEqual(persisted, []);
});
