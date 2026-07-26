import { createHash } from 'node:crypto';

const BLOCK = 512;
const MAX_ARCHIVE_BYTES = 8 * 1024 * 1024;
const MAX_ENTRIES = 128;
const MAX_MEMBER_BYTES = 4 * 1024 * 1024;
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const fail = () => {
  throw new Error('invalid tar');
};
const exact = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).length === keys.length &&
  Object.keys(value)
    .sort()
    .every((key, index) => key === [...keys].sort()[index]);
const zero = (bytes) => bytes.every((byte) => byte === 0);

function asciiField(header, start, length) {
  const bytes = header.subarray(start, start + length);
  const end = bytes.indexOf(0);
  const used = end < 0 ? bytes : bytes.subarray(0, end);
  if (
    (end >= 0 && !zero(bytes.subarray(end))) ||
    used.some((byte) => byte < 0x20 || byte > 0x7e)
  )
    fail();
  return used.toString('ascii');
}

function octal(header, start, length) {
  const bytes = header.subarray(start, start + length);
  const value = bytes.subarray(0, length - 1).toString('ascii');
  if (bytes[length - 1] !== 0) fail();
  if (!/^[0-7]+$/.test(value)) fail();
  const parsed = Number.parseInt(value, 8);
  if (!Number.isSafeInteger(parsed)) fail();
  return parsed;
}

function checksum(header) {
  const encoded = header.subarray(148, 156);
  if (!/^[0-7]{6}\0 $/.test(encoded.toString('ascii'))) fail();
  const stored = Number.parseInt(encoded.subarray(0, 6).toString('ascii'), 8);
  const actual = header.reduce(
    (sum, byte, index) => sum + (index >= 148 && index < 156 ? 0x20 : byte),
    0
  );
  if (stored !== actual) fail();
}

export function validSourcePath(path) {
  return (
    typeof path === 'string' &&
    /^infra\/cwv-runner\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+$/.test(path) &&
    !path.includes('..')
  );
}

function validEntries(entries) {
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES) fail();
  let previous = '';
  for (const row of entries) {
    if (
      !exact(row, ['mode', 'path', 'sha256']) ||
      !validSourcePath(row.path) ||
      !['100644', '100755'].includes(row.mode) ||
      !/^[a-f0-9]{64}$/.test(row.sha256) ||
      row.path <= previous
    )
      fail();
    previous = row.path;
  }
}

function readHeader(header) {
  if (
    header.subarray(257, 263).toString('ascii') !== 'ustar\0' ||
    header.subarray(263, 265).toString('ascii') !== '00' ||
    header[156] !== '0'.charCodeAt(0) ||
    !zero(header.subarray(157, 257)) ||
    !zero(header.subarray(108, 124)) ||
    !zero(header.subarray(136, 148)) ||
    !zero(header.subarray(265, 345)) ||
    !zero(header.subarray(500, 512))
  )
    fail();
  checksum(header);
  const name = asciiField(header, 0, 100);
  const prefix = asciiField(header, 345, 155);
  const path = prefix === '' ? name : `${prefix}/${name}`;
  const mode = `100${octal(header, 100, 8).toString(8).padStart(3, '0')}`;
  const size = octal(header, 124, 12);
  if (
    !validSourcePath(path) ||
    !['100644', '100755'].includes(mode) ||
    size > MAX_MEMBER_BYTES
  )
    fail();
  return { mode, path, size };
}

export function parseUstar(archive, expectedEntries) {
  if (
    !Buffer.isBuffer(archive) ||
    archive.length < BLOCK * 2 ||
    archive.length > MAX_ARCHIVE_BYTES ||
    archive.length % BLOCK !== 0
  )
    fail();
  validEntries(expectedEntries);
  const rows = [];
  let offset = 0;
  while (offset < archive.length) {
    const header = archive.subarray(offset, offset + BLOCK);
    if (zero(header)) {
      if (
        offset + BLOCK * 2 !== archive.length ||
        !zero(archive.subarray(offset + BLOCK))
      )
        fail();
      break;
    }
    if (rows.length === MAX_ENTRIES) fail();
    const { mode, path, size } = readHeader(header);
    const bodyStart = offset + BLOCK;
    const bodyEnd = bodyStart + size;
    const next = bodyEnd + ((BLOCK - (size % BLOCK)) % BLOCK);
    if (next > archive.length || !zero(archive.subarray(bodyEnd, next))) fail();
    const bytes = Buffer.from(archive.subarray(bodyStart, bodyEnd));
    rows.push({
      mode,
      path,
      sha256: hash(bytes),
      bytes,
    });
    offset = next;
  }
  if (
    offset + BLOCK * 2 !== archive.length ||
    rows.length !== expectedEntries.length
  )
    fail();
  for (let index = 0; index < rows.length; index += 1) {
    const expected = expectedEntries[index];
    const actual = rows[index];
    if (
      actual.path !== expected.path ||
      actual.mode !== expected.mode ||
      actual.sha256 !== expected.sha256
    )
      fail();
  }
  return rows;
}
