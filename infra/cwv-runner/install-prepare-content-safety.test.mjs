import assert from 'node:assert/strict';
import { chmod, lstat, mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  assertNoLiveReferences,
  assertOwnedTree,
  liveMountPoints,
  removeOwnedTree,
} from './install-prepare-content-safety.mjs';

const absentSocket = Object.assign(new Error('missing'), { code: 'ENOENT' });

test('decodes every mountinfo path escape before checking protected roots', async () => {
  const readMountInfo = async () =>
    '36 25 0:32 / /dedicated\\040root\\011tab\\012line\\134slash rw - ext4 /dev/root rw\n';

  const points = await liveMountPoints(readMountInfo);

  assert.deepEqual(points, ['/dedicated root\ttab\nline\\slash']);
});

test('fails closed on a non-race proc readlink failure', async () => {
  const sameMessageReadlinkFailure = Object.assign(
    new Error('live reference to dedicated content'),
    { code: 'EACCES' }
  );
  const operations = {
    lstat: async () => Promise.reject(absentSocket),
    readdir: async (directory) => (directory === '/proc' ? ['999999'] : ['7']),
    readlink: async () => Promise.reject(sameMessageReadlinkFailure),
  };

  await assert.rejects(
    assertNoLiveReferences([{ path: '/srv/baci-cwv' }], operations),
    (error) => error === sameMessageReadlinkFailure
  );
});

test('rethrows the dedicated containment breach by identity', async () => {
  const operations = {
    lstat: async () => Promise.reject(absentSocket),
    readdir: async (directory) => (directory === '/proc' ? ['999999'] : ['7']),
    readlink: async (link) =>
      link.endsWith('/cwd') ? '/srv/baci-cwv/live' : '/outside',
  };

  await assert.rejects(
    assertNoLiveReferences([{ path: '/srv/baci-cwv' }], operations),
    /live reference to dedicated content/
  );
});

test('refuses an owned cwd when fd enumeration is denied', async () => {
  const fdEnumerationDenied = Object.assign(new Error('permission denied'), {
    code: 'EACCES',
  });
  const operations = {
    lstat: async () => Promise.reject(absentSocket),
    readdir: (directory) => {
      if (directory === '/proc') return ['999999'];
      if (directory === '/proc/999999/fd') throw fdEnumerationDenied;
      throw new Error(`unexpected directory: ${directory}`);
    },
    readlink: async (link) =>
      link.endsWith('/cwd') ? '/srv/baci-cwv/live' : '/outside',
  };

  await assert.rejects(
    assertNoLiveReferences([{ path: '/srv/baci-cwv' }], operations),
    /live reference to dedicated content/
  );
});

test('tolerates a process exit during fd enumeration', async () => {
  const processExited = Object.assign(new Error('process exited'), {
    code: 'ESRCH',
  });
  const operations = {
    lstat: async () => Promise.reject(absentSocket),
    readdir: (directory) => {
      if (directory === '/proc') return ['999999'];
      if (directory === '/proc/999999/fd') throw processExited;
      throw new Error(`unexpected directory: ${directory}`);
    },
    readlink: async () => '/outside',
  };

  await assert.doesNotReject(
    assertNoLiveReferences([{ path: '/srv/baci-cwv' }], operations)
  );
});

test('fails closed on an unexpected proc readlink error', async () => {
  const unexpectedReadlinkFailure = Object.assign(new Error('device failure'), {
    code: 'EIO',
  });
  const operations = {
    lstat: async () => Promise.reject(absentSocket),
    readdir: async (directory) => (directory === '/proc' ? ['999999'] : ['7']),
    readlink: async () => Promise.reject(unexpectedReadlinkFailure),
  };

  await assert.rejects(
    assertNoLiveReferences([{ path: '/srv/baci-cwv' }], operations),
    (error) => error === unexpectedReadlinkFailure
  );
});

test('refuses deletion when a mount appears after owned-tree validation', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'cwv-owned-tree-'));
  context.after(() =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const owned = join(root, 'owned');
  await mkdir(owned, { mode: 0o700 });
  const rootDetails = await lstat(root);
  const row = { parentDev: rootDetails.dev };

  await assertOwnedTree(
    root,
    owned,
    row,
    [],
    process.getuid(),
    process.getgid()
  );
  await assert.rejects(
    () =>
      removeOwnedTree(
        root,
        owned,
        row,
        [owned],
        process.getuid(),
        process.getgid()
      ),
    /mount/
  );
  assert.equal((await lstat(owned)).isDirectory(), true);
});
