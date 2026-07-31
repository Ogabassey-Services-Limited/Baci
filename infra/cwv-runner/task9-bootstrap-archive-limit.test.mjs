import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';

import { createSourceArchive, verifySourceArchive } from './source-archive.mjs';
import { parseUstar } from './task9-bootstrap.mjs';

const sha256 = (value) => createHash('sha256').update(value).digest('hex');

function entries(count, size = 0) {
  return Array.from({ length: count }, (_, index) => {
    const bytes = Buffer.alloc(size, index % 251);
    return {
      bytes,
      mode: '100644',
      path: `infra/cwv-runner/member-${String(index).padStart(4, '0')}.mjs`,
      sha256: sha256(bytes),
    };
  });
}

function rechecksum(archive) {
  const header = archive.subarray(0, 512);
  header.fill(0x20, 148, 156);
  const value = header
    .reduce((sum, byte) => sum + byte, 0)
    .toString(8)
    .padStart(6, '0');
  header.write(value, 148, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
}

test('producer and sealed parser accept the 1024-member hard ceiling', () => {
  const source = entries(1024);
  const archive = createSourceArchive(
    source.map(({ bytes, mode, path, sha256: blobSha256 }) => ({
      blobSha256,
      bytes,
      mode,
      path,
    }))
  );
  const expected = source.map(({ mode, path, sha256 }) => ({
    mode,
    path,
    sha256,
  }));
  assert.equal(parseUstar(archive, expected).length, 1024);
});

test('producer and sealed parser retain a 1024-member hard ceiling', () => {
  const oversized = entries(1025);
  const expected = oversized.map(({ mode, path, sha256 }) => ({
    mode,
    path,
    sha256,
  }));
  assert.throws(
    () =>
      createSourceArchive(
        oversized.map(({ bytes, mode, path, sha256: blobSha256 }) => ({
          blobSha256,
          bytes,
          mode,
          path,
        }))
      ),
    /archive members/
  );
  assert.throws(() => parseUstar(Buffer.alloc(1024), expected), /tar/);
});

test('verifier and sealed parser reject noncanonical producer header drift', () => {
  const [source] = entries(1);
  const expectedArchive = [
    {
      blobSha256: source.sha256,
      mode: source.mode,
      path: source.path,
    },
  ];
  const expectedParser = [
    { mode: source.mode, path: source.path, sha256: source.sha256 },
  ];
  const archive = createSourceArchive([
    { ...expectedArchive[0], bytes: source.bytes },
  ]);
  for (const [offset, value] of [
    [100, 0],
    [156, '0'.charCodeAt(0)],
    [157, 'x'.charCodeAt(0)],
    [500, 'x'.charCodeAt(0)],
  ]) {
    const drifted = Buffer.from(archive);
    drifted[offset] = value;
    rechecksum(drifted);
    assert.throws(() => verifySourceArchive(drifted, expectedArchive));
    assert.throws(() => parseUstar(drifted, expectedParser), /tar/);
  }
});

test('producer refuses aggregate archive overflow before concatenation', () => {
  const oversized = entries(16, 1_048_576);
  const originalConcat = Buffer.concat;
  let concatenated = false;
  Buffer.concat = (...args) => {
    concatenated = true;
    return originalConcat(...args);
  };
  try {
    assert.throws(
      () =>
        createSourceArchive(
          oversized.map(({ bytes, mode, path, sha256: blobSha256 }) => ({
            blobSha256,
            bytes,
            mode,
            path,
          }))
        ),
      /archive exceeds size limit/
    );
    assert.equal(concatenated, false);
  } finally {
    Buffer.concat = originalConcat;
  }
});
