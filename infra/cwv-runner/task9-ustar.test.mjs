import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import test from 'node:test';
import { parseUstar } from './task9-ustar.mjs';

const BLOCK = 512;
const bytes = Buffer.from('safe');
const expected = [
  {
    mode: '100644',
    path: 'infra/cwv-runner/policy.json',
    sha256: createHash('sha256').update(bytes).digest('hex'),
  },
];

function octal(header, start, length, value) {
  header.write(value.toString(8).padStart(length - 1, '0'), start, 'ascii');
  header[start + length - 1] = 0;
}

function checksum(header) {
  header.fill(0x20, 148, 156);
  const value = header.reduce((sum, byte) => sum + byte, 0);
  header.write(value.toString(8).padStart(6, '0'), 148, 'ascii');
  header[154] = 0;
  header[155] = 0x20;
}

function archive() {
  const header = Buffer.alloc(BLOCK);
  const path = expected[0].path;
  const slash = path.lastIndexOf('/');
  header.write(path.slice(slash + 1), 0, 'ascii');
  header.write(path.slice(0, slash), 345, 'ascii');
  octal(header, 100, 8, 0o644);
  octal(header, 124, 12, bytes.length);
  header.write('ustar\0', 257, 'ascii');
  header.write('00', 263, 'ascii');
  header[156] = '0'.charCodeAt(0);
  checksum(header);
  return Buffer.concat([
    header,
    bytes,
    Buffer.alloc(BLOCK - bytes.length),
    Buffer.alloc(BLOCK * 2),
  ]);
}

function rechecksum(value) {
  checksum(value.subarray(0, BLOCK));
}

test('returns defensive member byte copies', () => {
  const value = archive();
  const [row] = parseUstar(value, expected);

  row.bytes[0] = 'X'.charCodeAt(0);

  assert.equal(value[BLOCK], 's'.charCodeAt(0));
  assert.equal(row.bytes.toString('ascii'), 'Xafe');
});

test('requires the canonical six-digit checksum layout', () => {
  const value = archive();
  assert.doesNotThrow(() => parseUstar(value, expected));

  const noncanonical = Buffer.from(value);
  const stored = noncanonical.subarray(148, 154).toString('ascii');
  noncanonical.write(`0${stored}`, 148, 'ascii');
  noncanonical[155] = 0;

  assert.throws(() => parseUstar(noncanonical, expected), /invalid tar/);
});

test('rejects every nonzero canonical metadata field', () => {
  const metadata = [
    ['uid', 108],
    ['gid', 116],
    ['mtime', 136],
    ['uname', 265],
    ['gname', 297],
    ['devmajor', 329],
    ['devminor', 337],
  ];

  for (const [name, offset] of metadata) {
    const value = archive();
    value[offset] = '1'.charCodeAt(0);
    rechecksum(value);
    assert.throws(() => parseUstar(value, expected), /invalid tar/, name);
  }
});

test('rejects delimiter-containing keys in the expected-entry schema', () => {
  const forged = [{ 'mode,path': '100644', sha256: expected[0].sha256 }];

  assert.throws(() => parseUstar(archive(), forged), /invalid tar/);
});
