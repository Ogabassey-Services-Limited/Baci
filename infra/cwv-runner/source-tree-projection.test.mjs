import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { gitSourceProjection } from './source-tree-projection.mjs';

const manifest = {
  mergeSha: 'a'.repeat(40),
  sourceArchive: { prefix: 'infra/cwv-runner/' },
};
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const row = (mode, type, objectId, path) =>
  Buffer.from(`${mode} ${type} ${objectId}\t${path}\0`);

test('enumerates every regular Git blob below the exact source prefix', () => {
  const calls = [];
  const result = gitSourceProjection(manifest, (args) => {
    calls.push(args);
    if (args[0] === 'cat-file') return Buffer.from(args[2][0]);
    return Buffer.concat([
      row('100644', 'blob', 'a'.repeat(40), 'infra/cwv-runner/build-image.mjs'),
      row('100755', 'blob', 'b'.repeat(40), 'infra/cwv-runner/entrypoint.sh'),
    ]);
  });

  assert.deepEqual(calls[0], [
    'ls-tree',
    '-r',
    '-z',
    manifest.mergeSha,
    '--',
    manifest.sourceArchive.prefix,
  ]);
  assert.deepEqual(calls.slice(1), [
    ['cat-file', 'blob', 'a'.repeat(40)],
    ['cat-file', 'blob', 'b'.repeat(40)],
  ]);
  assert.deepEqual(result, [
    {
      blobSha256: sha256('a'),
      mode: '100644',
      path: 'infra/cwv-runner/build-image.mjs',
    },
    {
      blobSha256: sha256('b'),
      mode: '100755',
      path: 'infra/cwv-runner/entrypoint.sh',
    },
  ]);
});

test('fails closed for unavailable, malformed, or nonregular tree leaves', () => {
  assert.throws(
    () =>
      gitSourceProjection(manifest, () => {
        throw new Error('missing');
      }),
    /Git tree unavailable/
  );
  for (const value of [
    Buffer.from([0xff]),
    row('120000', 'blob', 'b'.repeat(40), 'infra/cwv-runner/link'),
    row('160000', 'commit', 'b'.repeat(40), 'infra/cwv-runner/submodule'),
    row('100644', 'blob', 'b'.repeat(40), 'outside.mjs'),
  ])
    assert.throws(
      () => gitSourceProjection(manifest, () => value),
      /invalid source archive Git tree/
    );
  assert.throws(
    () =>
      gitSourceProjection(manifest, (args) => {
        if (args[0] === 'ls-tree')
          return row(
            '100644',
            'blob',
            'b'.repeat(40),
            'infra/cwv-runner/build-image.mjs'
          );
        throw new Error('missing blob');
      }),
    /Git blob unavailable/
  );
});
