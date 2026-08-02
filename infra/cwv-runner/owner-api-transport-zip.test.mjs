import assert from 'node:assert/strict';
import test from 'node:test';

import { readSoleArtifactMember } from './owner-api-transport-zip.mjs';

const name = Buffer.from('h0-runner-attestation.json');
const crc32 = (bytes) => {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1)
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
};
const zip = ({
  crc = crc32(Buffer.from('{}')),
  external = 0x81a40000,
} = {}) => {
  const bytes = Buffer.from('{}');
  const local = Buffer.alloc(30 + name.length);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(bytes.length, 18);
  local.writeUInt32LE(bytes.length, 22);
  local.writeUInt16LE(name.length, 26);
  name.copy(local, 30);
  const central = Buffer.alloc(46 + name.length);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(0x0314, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(bytes.length, 20);
  central.writeUInt32LE(bytes.length, 24);
  central.writeUInt16LE(name.length, 28);
  central.writeUInt32LE(external, 38);
  name.copy(central, 46);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(local.length + bytes.length, 16);
  return Buffer.concat([local, bytes, central, end]);
};

test('derives the member type and mode from matching safe ZIP publication metadata', () => {
  assert.deepEqual(readSoleArtifactMember(zip()), [
    {
      bytes: Buffer.from('{}'),
      isSymlink: false,
      mode: 0o644,
      name: 'h0-runner-attestation.json',
      type: 'file',
    },
  ]);
});

test('rejects a ZIP with a mismatched CRC or a symlink publication attribute', () => {
  assert.throws(() => readSoleArtifactMember(zip({ crc: 0 })), /zip/);
  assert.throws(
    () => readSoleArtifactMember(zip({ external: 0xa1ff0000 })),
    /zip/
  );
});
