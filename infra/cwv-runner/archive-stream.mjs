import { createHash } from 'node:crypto';
// biome-ignore format: closed fixed-tool filesystem surface stays visible as one inventory.
import { closeSync, fstatSync, mkdtempSync, openSync, readFileSync, readSync, rmSync, writeSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createArchiveIndex } from './archive-index.mjs';
import { validateArchiveLinks } from './archive-link-validation.mjs';
import { parseRunnerPolicy } from './policy.schema.mjs';

const policy = parseRunnerPolicy(
  JSON.parse(readFileSync(new URL('policy.json', import.meta.url)))
);
// biome-ignore format: one closed artifact budget keeps the module within its file cap.
const rootfsMemberBytes =
  policy.supplyChainProvenance.artifactMaxBytes * (Object.keys(policy.supplyChain).length + Object.keys(policy.supplyChainProvenance).length - 1);
export const archiveLimits = Object.freeze({
  archiveBytes: rootfsMemberBytes + 4 * 1024 * 1024,
  members: 256,
  memberBytes: rootfsMemberBytes,
  smallMemberBytes: 1024 * 1024,
  layerMembers: 131072,
});
const block = 512;
const archiveIo = { close: closeSync, open: openSync, write: writeSync };
const text = (bytes) =>
  Buffer.from(bytes).toString('utf8').replace(/\0.*$/, '');
const octal = (bytes) => {
  const value = text(bytes).trim();
  if (!/^[0-7]*$/.test(value)) throw new TypeError('invalid tar numeric field');
  return value ? Number.parseInt(value, 8) : 0;
};
// biome-ignore format: path normalization is one fail-closed predicate.
const safePath = (path) => typeof path === 'string' && path === path.normalize('NFC') && !path.startsWith('/') && !path.includes('\\') && path.split('/').every((part) => part && part !== '.' && part !== '..') && ![...path].some((char) => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127);
const zero = (bytes) => bytes.every((value) => value === 0);
const requireZeroRange = (read, offset, length, message) => {
  for (let cursor = 0; cursor < length; cursor += 64 * 1024) {
    const size = Math.min(64 * 1024, length - cursor);
    const bytes = read(offset + cursor, size);
    if (bytes.length !== size || !zero(bytes)) throw new TypeError(message);
  }
};
function verifyHeaderChecksum(header) {
  const field = header.subarray(148, 156).toString('latin1');
  if (!/^[0-7]{6}\0 $/.test(field))
    throw new TypeError('invalid tar header checksum');
  let sum = 0;
  for (let index = 0; index < header.length; index += 1)
    sum += index >= 148 && index < 156 ? 32 : header[index];
  if (sum !== Number.parseInt(field.slice(0, 6), 8))
    throw new TypeError('invalid tar header checksum');
}
// biome-ignore format: bounded tar parser signature preserves the module cap.
function parseTar(read, length, limits = archiveLimits, memberLimit = limits.layerMembers, instrumentation = undefined) {
  instrumentation?.parse();
  const records = [];
  const memberNames = new Set();
  let offset = 0;
  let physicalMembers = 0;
  while (offset < length) {
    const header = read(offset, block);
    if (header.length !== block) throw new TypeError('truncated tar header');
    if (zero(header)) {
      if (offset + block * 2 > length || !zero(read(offset + block, block)))
        throw new TypeError('invalid tar terminator');
      requireZeroRange(
        read,
        offset + block * 2,
        length - offset - block * 2,
        'nonzero bytes after tar terminator'
      );
      return validateArchiveLinks(records);
    }
    if (physicalMembers >= memberLimit)
      throw new TypeError('archive member count exceeds limit');
    physicalMembers += 1;
    verifyHeaderChecksum(header);
    const rawName = `${text(header.subarray(345, 500))}${text(header.subarray(345, 500)) ? '/' : ''}${text(header.subarray(0, 100))}`;
    const name = rawName.replace(/^\.\//, '').replace(/\/$/, '');
    if (!name || name === '.') {
      if (
        header[156] !== '5'.charCodeAt(0) ||
        octal(header.subarray(124, 136)) !== 0
      )
        throw new TypeError('unsafe tar member');
      offset += block;
      continue;
    }
    const type = String.fromCharCode(header[156] || 48);
    const size = octal(header.subarray(124, 136));
    const mode = octal(header.subarray(100, 108));
    const uid = octal(header.subarray(108, 116));
    const gid = octal(header.subarray(116, 124));
    const linkTarget = text(header.subarray(157, 257));
    if (
      !safePath(name) ||
      !['0', '\0', '5', '2', '1'].includes(type) ||
      ['x', 'g', 'L', 'K'].includes(type) ||
      size > limits.memberBytes
    )
      throw new TypeError(`unsafe tar member: ${name}`);
    if ((type === '2' || type === '1') && !linkTarget)
      throw new TypeError('unsafe tar link');
    if ((type === '5' || type === '2' || type === '1') && size !== 0)
      throw new TypeError('invalid tar member payload');
    const dataOffset = offset + block;
    const dataEnd = dataOffset + size;
    const next = dataOffset + Math.ceil(size / block) * block;
    if (next > length || memberNames.has(name))
      throw new TypeError('invalid or duplicate tar member');
    requireZeroRange(
      read,
      dataEnd,
      next - dataEnd,
      'nonzero tar member padding'
    );
    records.push({
      gid,
      linkTarget,
      mode,
      name,
      offset: dataOffset,
      rawName,
      size,
      type: type === '\0' ? '0' : type,
      uid,
    });
    memberNames.add(name);
    offset = next;
  }
  throw new TypeError('missing tar terminator');
}
function openArchive(path, limits = archiveLimits, filesystem = archiveIo) {
  const fd = filesystem.open(path, 'r');
  try {
    const size = fstatSync(fd).size;
    if (
      !Number.isSafeInteger(size) ||
      size < block * 2 ||
      size > limits.archiveBytes
    )
      throw new TypeError('archive size exceeds limit');
    return { fd, size };
  } catch (error) {
    filesystem.close(fd);
    throw error;
  }
}
function readAt(fd, offset, size) {
  const bytes = Buffer.alloc(size);
  const read = readSync(fd, bytes, 0, size, offset);
  return bytes.subarray(0, read);
}
// biome-ignore format: descriptor-bound parsing keeps the inspected archive identity stable.
const inspectOpenArchive = (fd, size, limits, memberLimit, instrumentation) => parseTar((offset, length) => readAt(fd, offset, length), size, limits, memberLimit, instrumentation);
// biome-ignore format: bounded archive parser dependencies stay explicit within the file cap.
export function inspectArchive(path, limits = archiveLimits, memberLimit = limits.members) {
  const { fd, size } = openArchive(path, limits);
  try {
    return inspectOpenArchive(fd, size, limits, memberLimit);
  } finally {
    closeSync(fd);
  }
}
// biome-ignore format: bounded member reader signature stays explicit within the file cap.
export function readArchiveMember(path, member, maximum = archiveLimits.smallMemberBytes) {
  if (
    !member ||
    maximum > archiveLimits.smallMemberBytes ||
    member.size > maximum
  )
    throw new TypeError('sealed archive member exceeds maximum size');
  const { fd } = openArchive(path);
  try {
    return readAt(fd, member.offset, member.size);
  } finally {
    closeSync(fd);
  }
}
// biome-ignore format: injected fixed-tool filesystem surface stays visible within the file cap.
function copyArchiveMember(fd, member, destination, limits = archiveLimits, filesystem = archiveIo) {
  if (!member || member.size > limits.memberBytes)
    throw new TypeError('archive member exceeds projection limit');
  let output;
  try {
    output = filesystem.open(destination, 'w', 0o600);
    for (let offset = 0; offset < member.size; ) {
      const bytes = readAt(
        fd,
        member.offset + offset,
        Math.min(64 * 1024, member.size - offset)
      );
      if (!bytes.length) throw new TypeError('truncated archive member');
      if (filesystem.write(output, bytes) !== bytes.length)
        throw new TypeError('short archive member write');
      offset += bytes.length;
    }
  } finally {
    if (output !== undefined) filesystem.close(output);
  }
}
export function archiveSha256(path) {
  const { fd, size } = openArchive(path);
  const hash = createHash('sha256');
  try {
    for (let offset = 0; offset < size; ) {
      const bytes = readAt(fd, offset, Math.min(64 * 1024, size - offset));
      if (!bytes.length) throw new TypeError('truncated archive');
      hash.update(bytes);
      offset += bytes.length;
    }
    return hash.digest('hex');
  } finally {
    closeSync(fd);
  }
}
export function inspectLayer(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length > archiveLimits.memberBytes)
    throw new TypeError('invalid layer bytes');
  return parseTar(
    (offset, size) => bytes.subarray(offset, offset + size),
    bytes.length,
    archiveLimits
  );
}
// biome-ignore format: bounded in-memory member reader stays visible within the file cap.
export function layerMemberBytes(bytes, member, maximum = archiveLimits.smallMemberBytes) {
  if (!member) throw new TypeError('missing layer member');
  if (member.size > maximum)
    throw new TypeError('sealed archive member exceeds maximum size');
  return bytes.subarray(member.offset, member.offset + member.size);
}
export function createArchiveWorkspace() {
  return mkdtempSync(join(tmpdir(), 'cwv-archive-verify-'));
}
export function removeArchiveWorkspace(path) {
  rmSync(path, { force: true, recursive: true });
}
// biome-ignore format: the descriptor-bound layer index closes over the validated archive snapshot.
export function openArchiveIndex(path, limits = archiveLimits, memberLimit = limits.layerMembers, filesystem = archiveIo) {
  const { fd, size } = openArchive(path, limits, filesystem);
  const instrumentation = { parses: 0, parse() { this.parses += 1; } };
  try {
    return createArchiveIndex(inspectOpenArchive(fd, size, limits, memberLimit, instrumentation), {
      close: () => filesystem.close(fd),
      extract(member, workspace, output) {
        const destination = join(workspace, output);
        copyArchiveMember(fd, member, destination, limits, filesystem);
        return destination;
      },
    }, instrumentation);
  } catch (error) {
    filesystem.close(fd);
    throw error;
  }
}
// biome-ignore format: raw member names preserve exact archive-detail lookups.
export function listArchiveMembers(archive) { const index = openArchiveIndex(archive); try { return index.members.map((member) => member.rawName); } finally { index.close(); } }
// biome-ignore format: injected copy boundary stays explicit within the file cap.
export function extractArchiveMember(archive, name, workspace, output, filesystem = archiveIo) {
  const index = openArchiveIndex(archive, archiveLimits, archiveLimits.layerMembers, filesystem);
  try { return index.extract(name, workspace, output); } finally { index.close(); }
}
// biome-ignore format: the compatibility wrapper retains one descriptor-bound index scope.
export function archiveMemberDetails(archive, name) { const index = openArchiveIndex(archive); try { return index.details(name); } finally { index.close(); } }
export function fileSha256(path) {
  const fd = openSync(path, 'r');
  const { size } = fstatSync(fd);
  if (!Number.isSafeInteger(size) || size > archiveLimits.memberBytes) {
    closeSync(fd);
    throw new TypeError('file exceeds projection limit');
  }
  const hash = createHash('sha256');
  try {
    for (let offset = 0; offset < size; ) {
      const bytes = readAt(fd, offset, Math.min(64 * 1024, size - offset));
      if (!bytes.length) throw new TypeError('truncated file');
      hash.update(bytes);
      offset += bytes.length;
    }
    return hash.digest('hex');
  } finally {
    closeSync(fd);
  }
}
export function readSmallMember(
  path,
  maximum = archiveLimits.smallMemberBytes,
  filesystem = archiveIo
) {
  const fd = filesystem.open(path, 'r');
  try {
    const { size } = fstatSync(fd);
    if (size > maximum)
      throw new TypeError('sealed archive member exceeds maximum size');
    return readAt(fd, 0, size);
  } finally {
    filesystem.close(fd);
  }
}
