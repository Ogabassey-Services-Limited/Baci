import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import test from 'node:test';

import { reconcileBootstrapReplacementResidue } from './install-bootstrap-replacement-residue.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const destination = '/etc/baci-cwv/runner.env';
const directory = dirname(destination);
const expectedBytes = Buffer.from('expected runner environment\n');
const priorBytes = Buffer.from('prior runner environment\n');
const expected = {
  sha256: sha256(expectedBytes),
  mode: '0644',
  owner: 'root:root',
};
const prior = {
  sha256: sha256(priorBytes),
  mode: '0644',
  owner: 'root:root',
};
const boundName = (digest = expected.sha256, attempt = 'attempt-1') =>
  `.baci-bootstrap-replacement-v2-${sha256(destination)}-${digest}-${attempt}`;

function fixture({ entries, projections, temporaryFiles = {} }) {
  const removed = [];
  const synced = [];
  const authorizedState = {
    currentDirectory: '/state/bootstrap-current',
    destination,
    files: { [destination]: expected },
    intent: { authorityChain: [] },
    prior: { [destination]: prior },
  };
  const descriptor = {
    readDirectory: (path) => {
      assert.equal(path, directory);
      return [...entries];
    },
    readProjection: (files) => {
      const [path] = Object.keys(files);
      assert.ok(projections[path], `missing projection for ${path}`);
      return { [path]: projections[path] };
    },
    readTemporary: (path) => {
      assert.ok(temporaryFiles[path], `missing temporary for ${path}`);
      return temporaryFiles[path];
    },
    removeFile: (path) => removed.push(path),
    syncDirectory: (path) => synced.push(path),
  };
  return { authorizedState, descriptor, removed, synced };
}

function reconcile(value, overrides = {}) {
  return reconcileBootstrapReplacementResidue(
    {
      destination,
      prior,
      expected,
      expectedBytes,
      authorizedState: value.authorizedState,
      ...overrides,
    },
    value.descriptor
  );
}

test('removes matching bound and legacy residue and syncs each removal', async () => {
  const names = [boundName(), '.baci-bootstrap-replacement-attempt-2'];
  const projections = Object.fromEntries(
    names.map((name, index) => [
      join(directory, name),
      index === 0 ? expected : { ...prior, mode: '0600' },
    ])
  );
  const value = fixture({ entries: names.reverse(), projections });

  await reconcile(value);

  assert.deepEqual(
    value.removed,
    names.sort().map((name) => join(directory, name))
  );
  assert.deepEqual(value.synced, [directory, directory]);
});

test('ignores a bound residue for another destination identity', async () => {
  const name = `.baci-bootstrap-replacement-v2-${'a'.repeat(64)}-${expected.sha256}-attempt`;
  const path = join(directory, name);
  const value = fixture({
    entries: [name],
    projections: { [path]: expected },
  });

  await reconcile(value);

  assert.deepEqual(value.removed, []);
  assert.deepEqual(value.synced, []);
});

test('retires a well-formed obsolete bound generation', async () => {
  const obsoleteBytes = Buffer.from('obsolete generation\n');
  const obsoleteDigest = sha256(obsoleteBytes);
  const name = boundName(obsoleteDigest);
  const path = join(directory, name);
  const value = fixture({
    entries: [name],
    projections: {
      [path]: { sha256: obsoleteDigest, mode: '0600', owner: 'root:baci-cwv' },
    },
  });

  await reconcile(value);

  assert.deepEqual(value.removed, [path]);
  assert.deepEqual(value.synced, [directory]);
});

test('removes historical residue authorized by a same-directory state row', async () => {
  const other = join(directory, 'bootstrap.sha256');
  const historical = '.tmp.A1b2C3';
  const path = join(directory, historical);
  const value = fixture({
    entries: [historical],
    projections: { [path]: { ...prior, mode: '0600' } },
  });
  value.authorizedState.files[other] = expected;
  value.authorizedState.prior[other] = prior;

  await reconcile(value);

  assert.deepEqual(value.removed, [path]);
  assert.deepEqual(value.synced, [directory]);
});

test('recovers an initial-install historical partial expected write', async () => {
  const name = '.tmp.A1b2C3';
  const path = join(directory, name);
  const partial = expectedBytes.subarray(0, 9);
  const value = fixture({
    entries: [name],
    projections: {
      [path]: { sha256: sha256(partial), mode: '0600', owner: 'root:root' },
    },
    temporaryFiles: { [path]: { bytes: partial, details: { nlink: 1 } } },
  });
  value.authorizedState.prior[destination] = { absent: true };

  await reconcile(value);

  assert.deepEqual(value.removed, [path]);
  assert.deepEqual(value.synced, [directory]);
});

test('recovers an exact partial expected write only when pinned and singly linked', async () => {
  const name = boundName();
  const path = join(directory, name);
  const partial = expectedBytes.subarray(0, 8);
  const value = fixture({
    entries: [name],
    projections: {
      [path]: { sha256: sha256(partial), mode: '0600', owner: 'root:root' },
    },
    temporaryFiles: { [path]: { bytes: partial, details: { nlink: 1 } } },
  });

  await reconcile(value);

  assert.deepEqual(value.removed, [path]);
  assert.deepEqual(value.synced, [directory]);
});

test('rejects malformed namespaces and drift without removing residue', async () => {
  const cases = [
    {
      name: '.baci-bootstrap-replacement-UPPERCASE',
      error: /unexpected bootstrap replacement residue/,
      projection: null,
    },
    {
      name: '.tmp.A1b2C3',
      error: /bootstrap replacement temporary drift/,
      projection: { sha256: 'f'.repeat(64), mode: '0600', owner: 'root:root' },
      temporary: {
        bytes: Buffer.from('foreign'),
        details: { nlink: 1 },
      },
    },
  ];
  for (const current of cases) {
    const path = join(directory, current.name);
    const value = fixture({
      entries: [current.name],
      projections: current.projection ? { [path]: current.projection } : {},
      temporaryFiles: current.temporary ? { [path]: current.temporary } : {},
    });
    await assert.rejects(reconcile(value), current.error);
    assert.deepEqual(value.removed, []);
    assert.deepEqual(value.synced, []);
  }
});

test('rejects partial bytes, extra links, and non-root metadata', async () => {
  const cases = [
    {
      bytes: Buffer.from('foreign'),
      nlink: 1,
      mode: '0600',
      owner: 'root:root',
    },
    {
      bytes: expectedBytes.subarray(0, 8),
      nlink: 2,
      mode: '0600',
      owner: 'root:root',
    },
    {
      bytes: expectedBytes.subarray(0, 8),
      nlink: 1,
      mode: '0644',
      owner: 'root:root',
    },
  ];
  for (const [index, current] of cases.entries()) {
    const name = boundName(expected.sha256, `attempt-${index}`);
    const path = join(directory, name);
    const value = fixture({
      entries: [name],
      projections: {
        [path]: {
          sha256: sha256(current.bytes),
          mode: current.mode,
          owner: current.owner,
        },
      },
      temporaryFiles: {
        [path]: { bytes: current.bytes, details: { nlink: current.nlink } },
      },
    });
    await assert.rejects(
      reconcile(value),
      /bootstrap replacement temporary drift/
    );
    assert.deepEqual(value.removed, []);
    assert.deepEqual(value.synced, []);
  }
});

test('rejects unsafe or foreign historical partial writes', async () => {
  const cases = [
    { bytes: Buffer.from('foreign'), nlink: 1, owner: 'root:root' },
    { bytes: expectedBytes.subarray(0, 8), nlink: 2, owner: 'root:root' },
    { bytes: expectedBytes.subarray(0, 8), nlink: 1, owner: '1000:1000' },
  ];
  for (const [index, current] of cases.entries()) {
    const name = `.tmp.A1b2C${index}`;
    const path = join(directory, name);
    const value = fixture({
      entries: [name],
      projections: {
        [path]: {
          sha256: sha256(current.bytes),
          mode: '0600',
          owner: current.owner,
        },
      },
      temporaryFiles: {
        [path]: { bytes: current.bytes, details: { nlink: current.nlink } },
      },
    });
    await assert.rejects(
      reconcile(value),
      /bootstrap replacement temporary drift/
    );
    assert.deepEqual(value.removed, []);
    assert.deepEqual(value.synced, []);
  }
});
