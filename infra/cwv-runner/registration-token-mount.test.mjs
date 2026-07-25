import assert from 'node:assert/strict';
import test from 'node:test';

import { assertRegistrationTokenMount } from './registration-token-mount.mjs';

const target = '/run/baci-cwv-registration/aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const details = (overrides = {}) => ({
  dev: 8,
  gid: 0,
  ino: 11,
  isDirectory: () => true,
  isSymbolicLink: () => false,
  mode: 0o40700,
  uid: 0,
  ...overrides,
});
const mountinfo = (row) =>
  Buffer.from(
    `1 2 0:8 / ${target} rw,nosuid,nodev,noexec - tmpfs tmpfs rw${row ?? ''}\n`
  );
const dependencies = (actual = details(), bytes = mountinfo()) => ({
  lstat: () => actual,
  readFile: () => bytes,
});

test('binds a token tmpfs to its exact device, inode, mountpoint, and hardening options', async () => {
  assert.deepEqual(
    await assertRegistrationTokenMount(target, details(), dependencies()),
    { dev: 8, ino: 11 }
  );
});

test('rejects token mount substitutions, symlinks, wrong filesystems, options, ownership, and mode', async () => {
  const cases = [
    [details({ ino: 12 }), mountinfo()],
    [details({ isSymbolicLink: () => true }), mountinfo()],
    [
      details(),
      Buffer.from(
        '1 2 0:8 / /tmp/substituted rw,nosuid,nodev,noexec - tmpfs tmpfs rw\n'
      ),
    ],
    [
      details(),
      Buffer.from(
        `1 2 0:8 / ${target} rw,nosuid,nodev,noexec - ext4 /dev/sda rw\n`
      ),
    ],
    [
      details(),
      Buffer.from(`1 2 0:8 / ${target} rw,nosuid,nodev - tmpfs tmpfs rw\n`),
    ],
    [details({ uid: 10001 }), mountinfo()],
    [details({ mode: 0o40755 }), mountinfo()],
  ];
  for (const [actual, bytes] of cases)
    await assert.rejects(
      assertRegistrationTokenMount(
        target,
        details(),
        dependencies(actual, bytes)
      ),
      /registration token mount refused/
    );
});
