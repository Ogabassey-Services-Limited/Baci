import assert from 'node:assert/strict';
import test from 'node:test';

import { readRootRuntimeOwnedFile } from './root-runtime-owned-read.mjs';

const details = (patch = {}) => ({
  dev: 1,
  gid: 0,
  ino: 2,
  isFile: () => true,
  isSymbolicLink: () => false,
  mode: 0o100400,
  nlink: 1,
  size: 3,
  uid: 0,
  ...patch,
});

function dependencies(options = {}) {
  const bytes = Buffer.from('abc');
  const before = details(options.before);
  const opened = details(options.opened);
  const after = details(options.after);
  return {
    lstat: () => before,
    open: () => ({
      close: () => undefined,
      read: (target, offset, length, position) => {
        const source =
          options.growth && position === 3 ? Buffer.from('d') : bytes;
        const start = options.growth && position === 3 ? 0 : position;
        const available = Math.min(length, Math.max(0, source.length - start));
        source.copy(target, offset, start, start + available);
        return {
          bytesRead: options.truncate && position === 0 ? 2 : available,
        };
      },
      stat: (() => {
        let calls = 0;
        return () => (calls++ === 0 ? opened : after);
      })(),
    }),
  };
}

test('reads exactly the snapshotted root-owned file and probes EOF', async () => {
  assert.deepEqual(
    await readRootRuntimeOwnedFile('/fixed', 10, dependencies()),
    Buffer.from('abc')
  );
});

test('refuses truncated, growing, inode-changed, or unsafe files', async () => {
  for (const options of [
    { truncate: true },
    { growth: true },
    { after: { ino: 3 } },
    { before: { mode: 0o100600 } },
  ])
    await assert.rejects(
      readRootRuntimeOwnedFile('/fixed', 10, dependencies(options)),
      /root runtime registration adapter refused/
    );
});
