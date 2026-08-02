import { inflateRawSync } from 'node:zlib';

import { fail } from './owner-api-transport-primitives.mjs';

const LIMIT = 1024 * 1024;
const SIGNATURE = {
  central: 0x02014b50,
  descriptor: 0x08074b50,
  end: 0x06054b50,
  local: 0x04034b50,
};
const table = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1)
    value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  return value;
});
const crc32 = (bytes) => {
  let value = 0xffffffff;
  for (const byte of bytes) value = (value >>> 8) ^ table[(value ^ byte) & 255];
  return (value ^ 0xffffffff) >>> 0;
};
const need = (archive, offset, length) => {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > archive.length
  )
    fail('invalid zip');
};
function u16(archive, offset) {
  need(archive, offset, 2);
  return archive.readUInt16LE(offset);
}
function u32(archive, offset) {
  need(archive, offset, 4);
  return archive.readUInt32LE(offset);
}
function bytesAt(archive, offset, length) {
  need(archive, offset, length);
  return archive.subarray(offset, offset + length);
}
const equal = (left, right) =>
  left.length === right.length && left.equals(right);

function endRecord(archive) {
  const offset = archive.length - 22;
  if (
    archive.length > LIMIT ||
    archive.length < 68 ||
    u32(archive, offset) !== SIGNATURE.end ||
    u16(archive, offset + 4) ||
    u16(archive, offset + 6) ||
    u16(archive, offset + 8) !== 1 ||
    u16(archive, offset + 10) !== 1 ||
    u16(archive, offset + 20)
  )
    fail('invalid zip');
  const centralOffset = u32(archive, offset + 16);
  const centralLength = u32(archive, offset + 12);
  if (centralOffset + centralLength !== offset) fail('invalid zip');
  return { centralLength, centralOffset };
}

function localRecord(archive) {
  if (u32(archive, 0) !== SIGNATURE.local) fail('invalid zip');
  const flags = u16(archive, 6);
  const method = u16(archive, 8);
  const crc = u32(archive, 14);
  const compressed = u32(archive, 18);
  const size = u32(archive, 22);
  const nameLength = u16(archive, 26);
  const extraLength = u16(archive, 28);
  const name = bytesAt(archive, 30, nameLength);
  const dataOffset = 30 + nameLength + extraLength;
  if (extraLength || flags & ~0x808 || ![0, 8].includes(method))
    fail('invalid zip');
  return { compressed, crc, dataOffset, flags, method, name, size };
}

function centralRecord(archive, { centralLength, centralOffset }) {
  if (u32(archive, centralOffset) !== SIGNATURE.central || centralLength < 46)
    fail('invalid zip');
  const madeBy = u16(archive, centralOffset + 4);
  const flags = u16(archive, centralOffset + 8);
  const method = u16(archive, centralOffset + 10);
  const crc = u32(archive, centralOffset + 16);
  const compressed = u32(archive, centralOffset + 20);
  const size = u32(archive, centralOffset + 24);
  const nameLength = u16(archive, centralOffset + 28);
  const extraLength = u16(archive, centralOffset + 30);
  const commentLength = u16(archive, centralOffset + 32);
  const disk = u16(archive, centralOffset + 34);
  const internal = u16(archive, centralOffset + 36);
  const external = u32(archive, centralOffset + 38);
  const offset = u32(archive, centralOffset + 42);
  const name = bytesAt(archive, centralOffset + 46, nameLength);
  const mode = external >>> 16;
  if (
    madeBy >>> 8 !== 3 ||
    extraLength ||
    commentLength ||
    disk ||
    internal ||
    offset ||
    centralLength !== 46 + nameLength ||
    flags & ~0x808 ||
    ![0, 8].includes(method) ||
    (mode & 0o170000) !== 0o100000 ||
    (mode & 0o777) !== 0o644
  )
    fail('invalid zip');
  return { compressed, crc, flags, method, mode, name, size };
}

function payload(archive, local, central, centralOffset) {
  if (
    local.flags !== central.flags ||
    local.method !== central.method ||
    !equal(local.name, central.name) ||
    central.size > LIMIT ||
    central.compressed > LIMIT
  )
    fail('invalid zip');
  const end = local.dataOffset + central.compressed;
  need(archive, local.dataOffset, central.compressed);
  const descriptorLength = centralOffset - end;
  if (local.flags & 8) {
    if (
      local.crc ||
      local.compressed ||
      local.size ||
      ![12, 16].includes(descriptorLength)
    )
      fail('invalid zip');
    const start = descriptorLength === 16 ? end + 4 : end;
    if (
      (descriptorLength === 16 && u32(archive, end) !== SIGNATURE.descriptor) ||
      u32(archive, start) !== central.crc ||
      u32(archive, start + 4) !== central.compressed ||
      u32(archive, start + 8) !== central.size
    )
      fail('invalid zip');
  } else if (
    descriptorLength ||
    local.crc !== central.crc ||
    local.compressed !== central.compressed ||
    local.size !== central.size
  )
    fail('invalid zip');
  let bytes;
  try {
    bytes =
      central.method === 0
        ? Buffer.from(bytesAt(archive, local.dataOffset, central.compressed))
        : inflateRawSync(
            bytesAt(archive, local.dataOffset, central.compressed),
            { maxOutputLength: central.size }
          );
  } catch {
    fail('invalid zip');
  }
  if (bytes.length !== central.size || crc32(bytes) !== central.crc)
    fail('invalid zip');
  return bytes;
}

export function readSoleArtifactMember(archive) {
  if (!Buffer.isBuffer(archive)) fail('invalid zip');
  const end = endRecord(archive);
  const local = localRecord(archive);
  const central = centralRecord(archive, end);
  if (
    local.name.toString('utf8') !== 'h0-runner-attestation.json' ||
    !equal(local.name, Buffer.from('h0-runner-attestation.json'))
  )
    fail('invalid zip');
  const bytes = payload(archive, local, central, end.centralOffset);
  return [
    {
      bytes,
      isSymlink: false,
      mode: central.mode & 0o777,
      name: 'h0-runner-attestation.json',
      type: 'file',
    },
  ];
}
