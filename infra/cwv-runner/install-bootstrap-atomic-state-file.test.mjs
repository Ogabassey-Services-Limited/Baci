import assert from 'node:assert/strict';
import { lstat, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { writeBootstrapStateFileAtomic } from './install-bootstrap-atomic-state-file.mjs';

const fulfilled = (value) => Promise.resolve(value);
const rejected = (error) => Promise.reject(error);

test('publishes each authorized bootstrap state file with exact bytes and mode', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-atomic-state-'));
  context.after(() => rm(directory, { force: true, recursive: true }));

  for (const [name, temporaryName, bytes] of [
    ['capture.json', '.capture-json-stage', '{"phase":"captured"}\n'],
    ['capture.sha256', '.capture-sha256-stage', `${'a'.repeat(64)}\n`],
  ]) {
    await writeBootstrapStateFileAtomic(directory, name, bytes);

    assert.equal(await readFile(join(directory, name), 'utf8'), bytes);
    assert.equal((await stat(join(directory, name))).mode & 0o777, 0o600);
    await assert.rejects(lstat(join(directory, temporaryName)), {
      code: 'ENOENT',
    });
  }
});

test('refuses every state-file name outside the closed capture allowlist', async () => {
  let opened = false;
  for (const name of [
    '',
    'capture',
    'capture.json/child',
    '../capture.json',
    '/capture.json',
    'receipt.json',
  ]) {
    await assert.rejects(
      writeBootstrapStateFileAtomic('/state', name, 'bytes', {
        openFile: () => {
          opened = true;
          return rejected(new Error('must not open'));
        },
      }),
      {
        name: 'TypeError',
        message: 'invalid atomic bootstrap state file',
      }
    );
  }
  assert.equal(opened, false);
});

test('orders write durability before rename and parent durability after rename', async () => {
  const events = [];
  const bytes = Buffer.from('capture');

  await writeBootstrapStateFileAtomic('/state', 'capture.json', bytes, {
    openFile(path, flags, mode) {
      events.push(['open', path, flags, mode]);
      return fulfilled({
        writeFile(value) {
          events.push(['write', value]);
          return fulfilled();
        },
        sync() {
          events.push(['sync-file']);
          return fulfilled();
        },
        close() {
          events.push(['close']);
          return fulfilled();
        },
      });
    },
    renameFile(source, destination) {
      events.push(['rename', source, destination]);
      return fulfilled();
    },
    removeFile() {
      assert.fail('successful publication must not run cleanup');
    },
    syncDirectory(path) {
      events.push(['sync-directory', path]);
      return fulfilled();
    },
  });

  assert.deepEqual(events, [
    ['open', '/state/.capture-json-stage', 'wx', 0o600],
    ['write', bytes],
    ['sync-file'],
    ['close'],
    ['rename', '/state/.capture-json-stage', '/state/capture.json'],
    ['sync-directory', '/state'],
  ]);
});

test('does not clean up when exclusive temporary creation fails', async () => {
  const failure = new Error('exclusive open failed');
  let cleanupCalled = false;

  await assert.rejects(
    writeBootstrapStateFileAtomic('/state', 'capture.json', 'bytes', {
      openFile() {
        return rejected(failure);
      },
      removeFile() {
        cleanupCalled = true;
        return fulfilled();
      },
    }),
    (error) => error === failure
  );
  assert.equal(cleanupCalled, false);
});

test('removes and durably records a temporary after a write failure', async () => {
  const failure = new Error('partial write');
  const events = [];

  await assert.rejects(
    writeBootstrapStateFileAtomic('/state', 'capture.sha256', 'bytes', {
      openFile() {
        return fulfilled({
          writeFile() {
            events.push('write');
            return rejected(failure);
          },
          sync() {
            assert.fail('failed writes must not be synced');
          },
          close() {
            events.push('close');
            return fulfilled();
          },
        });
      },
      removeFile(path, options) {
        events.push(['remove', path, options]);
        return fulfilled();
      },
      syncDirectory(path) {
        events.push(['sync-directory', path]);
        return fulfilled();
      },
    }),
    (error) => error === failure
  );
  assert.deepEqual(events, [
    'write',
    'close',
    ['remove', '/state/.capture-sha256-stage', { force: true }],
    ['sync-directory', '/state'],
  ]);
});

test('cleans a durable temporary when atomic publication fails', async () => {
  const failure = new Error('rename failed');
  const events = [];

  await assert.rejects(
    writeBootstrapStateFileAtomic('/state', 'capture.json', 'bytes', {
      openFile() {
        return fulfilled({
          writeFile: () => fulfilled(),
          sync: () => fulfilled(),
          close: () => fulfilled(),
        });
      },
      renameFile() {
        return rejected(failure);
      },
      removeFile(path, options) {
        events.push(['remove', path, options]);
        return fulfilled();
      },
      syncDirectory(path) {
        events.push(['sync-directory', path]);
        return fulfilled();
      },
    }),
    (error) => error === failure
  );
  assert.deepEqual(events, [
    ['remove', '/state/.capture-json-stage', { force: true }],
    ['sync-directory', '/state'],
  ]);
});

test('preserves the original close failure when retry and cleanup also fail', async () => {
  const failure = new Error('close failed');
  const events = [];

  await assert.rejects(
    writeBootstrapStateFileAtomic('/state', 'capture.json', 'bytes', {
      openFile() {
        return fulfilled({
          writeFile: () => fulfilled(),
          sync: () => fulfilled(),
          close() {
            events.push('close');
            return rejected(failure);
          },
        });
      },
      renameFile() {
        assert.fail('a failed close must prevent publication');
      },
      removeFile() {
        events.push('remove');
        return rejected(new Error('remove failed'));
      },
      syncDirectory() {
        events.push('sync-directory');
        return fulfilled();
      },
    }),
    (error) => error === failure
  );
  assert.deepEqual(events, ['close', 'close', 'remove']);
});

test('does not remove an already-published destination when parent sync fails', async () => {
  const failure = new Error('parent sync failed');
  const events = [];

  await assert.rejects(
    writeBootstrapStateFileAtomic('/state', 'capture.json', 'bytes', {
      openFile() {
        return fulfilled({
          writeFile: () => fulfilled(),
          sync: () => fulfilled(),
          close: () => fulfilled(),
        });
      },
      renameFile() {
        events.push('rename');
        return fulfilled();
      },
      removeFile() {
        events.push('remove');
        return fulfilled();
      },
      syncDirectory() {
        events.push('sync-directory');
        return rejected(failure);
      },
    }),
    (error) => error === failure
  );
  assert.deepEqual(events, ['rename', 'sync-directory']);
});
