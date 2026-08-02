import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { validateRootfsProjectionInventory } from './rootfs-projection-contract.mjs';

const digest = 'a'.repeat(64);
const sourceEntry = {
  gid: 0,
  kind: 'deb',
  mode: '0644',
  owner: 'ca-certificates',
  path: 'etc/ca-certificates.conf',
  sha256: digest,
  sourceSha256: digest,
  type: '0',
  uid: 0,
};
const projection = new Map([
  ['etc/group', { kind: 'generated', owner: 'identity', path: 'etc/group' }],
  ['etc/passwd', { kind: 'generated', owner: 'identity', path: 'etc/passwd' }],
  [
    'etc/ssl/certs/ca-certificates.crt',
    {
      kind: 'generated',
      owner: 'trust',
      path: 'etc/ssl/certs/ca-certificates.crt',
    },
  ],
  [
    sourceEntry.path,
    { kind: 'package', owner: 'ca-certificates', path: sourceEntry.path },
  ],
  [
    'runner-work',
    { kind: 'generated', owner: 'directory', path: 'runner-work' },
  ],
  [
    'opt/baci-cwv/policy.json',
    { kind: 'declared', owner: 'baci', path: 'opt/baci-cwv/policy.json' },
  ],
  [
    'opt/baci-cwv/rootfs-projection.json',
    {
      kind: 'declared',
      owner: 'baci',
      path: 'opt/baci-cwv/rootfs-projection.json',
    },
  ],
  [
    'var/lib/dpkg/status',
    { kind: 'generated', owner: 'dpkg-query', path: 'var/lib/dpkg/status' },
  ],
]);
const archiveRows = () =>
  new Map([
    [
      'etc/group',
      {
        gid: 0,
        mode: '0644',
        path: 'etc/group',
        sha256: createHash('sha256').update('runner:x:10001:\n').digest('hex'),
        type: '0',
        uid: 0,
      },
    ],
    [
      'etc/passwd',
      {
        gid: 0,
        mode: '0644',
        path: 'etc/passwd',
        sha256: createHash('sha256')
          .update(
            'runner:x:10001:10001:Baci CWV Runner:/home/runner:/bin/bash\n'
          )
          .digest('hex'),
        type: '0',
        uid: 0,
      },
    ],
    [
      'etc/ssl/certs/ca-certificates.crt',
      {
        gid: 0,
        mode: '0444',
        path: 'etc/ssl/certs/ca-certificates.crt',
        type: '0',
        uid: 0,
      },
    ],
    [sourceEntry.path, sourceEntry],
    [
      'runner-work',
      { gid: 10001, mode: '0700', path: 'runner-work', type: '5', uid: 10001 },
    ],
    [
      'opt/baci-cwv/policy.json',
      {
        gid: 0,
        mode: '0444',
        path: 'opt/baci-cwv/policy.json',
        type: '0',
        uid: 0,
      },
    ],
    [
      'opt/baci-cwv/rootfs-projection.json',
      {
        gid: 0,
        mode: '0644',
        path: 'opt/baci-cwv/rootfs-projection.json',
        type: '0',
        uid: 0,
      },
    ],
    [
      'var/lib/dpkg/status',
      { gid: 0, mode: '0444', path: 'var/lib/dpkg/status', type: '0', uid: 0 },
    ],
  ]);
const inventory = new Map([[sourceEntry.path, sourceEntry]]);

test('requires an exact archive row for every claimed projection entry', () => {
  const rows = archiveRows();
  assert.doesNotThrow(() =>
    validateRootfsProjectionInventory(projection, inventory, rows)
  );
  for (const path of projection.keys()) {
    const missing = new Map(rows);
    missing.delete(path);
    assert.throws(
      () => validateRootfsProjectionInventory(projection, inventory, missing),
      /rootfs projection archive identity mismatch/
    );
  }
});

test('refuses type or mode drift for writable, trust, policy, and source rows', () => {
  for (const path of [
    'runner-work',
    'etc/ssl/certs/ca-certificates.crt',
    sourceEntry.path,
    'opt/baci-cwv/policy.json',
  ]) {
    const rows = archiveRows();
    rows.set(path, { ...rows.get(path), mode: '0777', type: '0' });
    assert.throws(
      () => validateRootfsProjectionInventory(projection, inventory, rows),
      /rootfs projection archive identity mismatch/
    );
  }
});
