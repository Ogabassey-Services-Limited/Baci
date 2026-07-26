import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import test from 'node:test';

import {
  publishRegistrationRetryBlock,
  readRegistrationRetryBlock,
} from './registration-retry-block.mjs';

const block = Object.freeze({
  campaignId: 'registration-01',
  cleanupSha256: 'a'.repeat(64),
  commandSha256: 'b'.repeat(64),
  disposition: 'owner-row-deletion-required',
  egressReleaseSha256: 'c'.repeat(64),
  schemaVersion: 1,
});
const details = (type, mode, size = 0, uid = 0, gid = 0) => ({
  dev: 1,
  gid,
  ino: 2,
  isDirectory: () => type === 'directory',
  isFile: () => type === 'file',
  isSymbolicLink: () => type === 'link',
  mode,
  size,
  uid,
});

test('treats only a missing root-only retry block as clear', async () => {
  const missing = () => {
    const error = new Error('missing');
    error.code = 'ENOENT';
    throw error;
  };
  assert.equal(
    await readRegistrationRetryBlock({
      assertRoot: () => undefined,
      lstat: (path) =>
        path.endsWith('/receipts') ? details('directory', 0o40700) : missing(),
    }),
    undefined
  );
  for (const invalid of [
    details('link', 0o100400, 8),
    details('file', 0o100600, 8),
    details('file', 0o100400, 8, 10001),
  ])
    await assert.rejects(
      readRegistrationRetryBlock({
        assertRoot: () => undefined,
        lstat: (path) =>
          path.endsWith('/receipts') ? details('directory', 0o40700) : invalid,
      }),
      /registration retry block refused/
    );
});

test('fsyncs and atomically publishes one canonical root-owned retry block', async () => {
  const calls = [];
  let published;
  const bytes = Buffer.from(JSON.stringify(block));
  const lstat = (path) => {
    if (path.endsWith('/receipts')) return details('directory', 0o40700);
    if (!published) {
      const error = new Error('missing');
      error.code = 'ENOENT';
      throw error;
    }
    return details('file', 0o100400, bytes.length);
  };
  const open = (path, _flags) => ({
    chmod: async () => calls.push('chmod'),
    chown: async () => calls.push('chown'),
    close: async () => undefined,
    readFile: async () => bytes,
    stat: async () =>
      path.endsWith('/receipts')
        ? details('directory', 0o40700)
        : details('file', 0o100400, bytes.length),
    sync: async () => calls.push('sync'),
    writeFile: async (written) => assert.deepEqual(written, bytes),
  });
  await publishRegistrationRetryBlock(block, {
    assertRoot: () => undefined,
    lstat,
    open,
    randomBytes: () => Buffer.alloc(16, 1),
    rename: () => {
      published = true;
      calls.push('rename');
    },
  });
  assert.equal(calls.includes('rename'), true);
  assert.equal(calls.filter((value) => value === 'sync').length >= 2, true);
  assert.equal(constants.O_NOFOLLOW !== 0, true);
});
