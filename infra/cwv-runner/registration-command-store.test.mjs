import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import test from 'node:test';

import {
  publishRegistrationCommand,
  readCompletedRegistrationCommand,
  readRegistrationCommand,
  readRegistrationCommandIfPresent,
} from './registration-command-store.mjs';

const bytes = Buffer.from('{"schemaVersion":2}');
const digest = createHash('sha256').update(bytes).digest('hex');
const details = (type, mode, size = 0) => ({
  dev: 1,
  gid: 0,
  ino: 2,
  isDirectory: () => type === 'directory',
  isFile: () => type === 'file',
  isSymbolicLink: () => false,
  mode,
  nlink: 1,
  size,
  uid: 0,
});
const missing = (message = 'missing') => {
  const error = new Error(message);
  error.code = 'ENOENT';
  return error;
};
const readableCommandDependencies = (directory) => ({
  assertRoot: () => undefined,
  lstat: (path) =>
    details(
      path.endsWith('root-runtime-command') || path.endsWith(directory)
        ? 'directory'
        : 'file',
      path.endsWith('root-runtime-command') || path.endsWith(directory)
        ? 0o40700
        : 0o100400,
      path.endsWith('.sha256') ? 65 : bytes.length
    ),
  open: (path, flags) => {
    assert.notEqual(flags & constants.O_NOFOLLOW, 0);
    const value = path.endsWith('.sha256') ? Buffer.from(`${digest}\n`) : bytes;
    return {
      close: () => undefined,
      read: (target, offset, length, position) => {
        const count = Math.min(length, Math.max(0, value.length - position));
        value.copy(target, offset, position, position + count);
        return { bytesRead: count };
      },
      readFile: () => value,
      stat: () => details('file', 0o100400, value.length),
    };
  },
});

test('publishes a no-overwrite root-owned active bundle with synced canonical files', async () => {
  const calls = [];
  const files = [];
  const dependencies = {
    assertRoot: () => undefined,
    lstat: (path) => {
      if (path.endsWith('/active')) {
        const error = new Error('missing');
        error.code = 'ENOENT';
        throw error;
      }
      return details('directory', 0o40700);
    },
    mkdir: (path, options) => calls.push(['mkdir', path, options]),
    open: (path, flags, mode) => {
      calls.push(['open', path, flags, mode]);
      const content = files.length === 0 ? bytes : Buffer.from(`${digest}\n`);
      files.push(content);
      return {
        close: () => calls.push(['close', path]),
        readFile: () => content,
        stat: () => details('file', 0o100400, content.length),
        sync: () => calls.push(['sync', path]),
        writeFile: (written) => assert.deepEqual(written, content),
      };
    },
    rename: (from, to) => calls.push(['rename', from, to]),
  };
  await publishRegistrationCommand(bytes, dependencies);
  assert.equal(
    calls.some(([name]) => name === 'rename'),
    true
  );
  assert.equal(
    calls
      .filter(([name]) => name === 'open')
      .every(([, , flags]) => (flags & constants.O_NOFOLLOW) !== 0),
    true
  );
  assert.equal(calls.filter(([name]) => name === 'sync').length >= 3, true);
});

test('rejects active publication reuse and verifies readback against its receipt', async () => {
  await assert.rejects(
    publishRegistrationCommand(bytes, {
      assertRoot: () => undefined,
      mkdir: () => undefined,
      lstat: () => details('directory', 0o40700),
    }),
    /registration command store refused/
  );
  const result = await readRegistrationCommand(
    readableCommandDependencies('/active')
  );
  assert.deepEqual(result, bytes);
});

test('returns undefined when the command store root is absent', async () => {
  const result = await readRegistrationCommandIfPresent({
    assertRoot: () => undefined,
    lstat: () => {
      throw missing('store absent');
    },
  });

  assert.equal(result, undefined);
});

test('returns undefined when the active command is absent', async () => {
  const result = await readRegistrationCommandIfPresent({
    assertRoot: () => undefined,
    lstat: (path) => {
      if (path.endsWith('/active')) throw missing('active absent');
      return details('directory', 0o40700);
    },
  });

  assert.equal(result, undefined);
});

test('rethrows non-absence errors while checking for an active command', async () => {
  const denied = new Error('permission denied');
  denied.code = 'EACCES';

  await assert.rejects(
    readRegistrationCommandIfPresent({
      assertRoot: () => undefined,
      lstat: () => {
        throw denied;
      },
    }),
    (error) => error === denied
  );
});

test('recursively removes its unique pending directory without masking a publication TypeError', async () => {
  const publicationError = new TypeError('write failed');
  const removed = [];

  await assert.rejects(
    publishRegistrationCommand(bytes, {
      assertRoot: () => undefined,
      lstat: (path) => {
        if (path.endsWith('/active')) throw missing();
        return details('directory', 0o40700);
      },
      mkdir: () => undefined,
      open: () => {
        throw publicationError;
      },
      randomBytes: () => Buffer.alloc(16, 7),
      rm: (path, options) => {
        removed.push([path, options]);
        throw new Error('cleanup failed');
      },
    }),
    (error) => error === publicationError
  );
  assert.deepEqual(removed, [
    [
      '/srv/baci-cwv/receipts/root-runtime-command/pending-07070707070707070707070707070707',
      { force: true, recursive: true },
    ],
  ]);
});

test('does not let cleanup failure replace a normalized publication error', async () => {
  await assert.rejects(
    publishRegistrationCommand(bytes, {
      assertRoot: () => undefined,
      lstat: (path) => {
        if (path.endsWith('/active')) throw missing();
        return details('directory', 0o40700);
      },
      mkdir: () => undefined,
      open: () => {
        throw new Error('sensitive I/O detail');
      },
      randomBytes: () => Buffer.alloc(16, 9),
      rm: () => {
        throw new Error('cleanup failed');
      },
    }),
    (error) =>
      error instanceof TypeError &&
      error.message === 'registration command store refused'
  );
});

test('does not clean the published active command after a successful rename', async () => {
  let opened = 0;
  const removed = [];

  await publishRegistrationCommand(bytes, {
    assertRoot: () => undefined,
    lstat: (path) => {
      if (path.endsWith('/active')) throw missing();
      return details('directory', 0o40700);
    },
    mkdir: () => undefined,
    open: () => ({
      close: () => undefined,
      sync: () => undefined,
      writeFile: (written) => {
        const expected = opened++ === 0 ? bytes : Buffer.from(`${digest}\n`);
        assert.deepEqual(written, expected);
      },
    }),
    randomBytes: () => Buffer.alloc(16, 8),
    rename: () => undefined,
    rm: (...args) => removed.push(args),
  });

  assert.deepEqual(removed, []);
});

test('reads the exact completed command against its archived digest', async () => {
  const result = await readCompletedRegistrationCommand(
    readableCommandDependencies('/archive')
  );

  assert.deepEqual(result, bytes);
});
