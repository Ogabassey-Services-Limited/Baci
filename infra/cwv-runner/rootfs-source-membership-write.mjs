import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
  readSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

import { archiveLimits, inspectArchive } from './archive-stream.mjs';
import { canonicalJson } from './canonical-json.mjs';

const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exactKeys = (value, keys) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  canonicalJson(Object.keys(value).sort()) === canonicalJson([...keys].sort());
const safePath = (path) =>
  typeof path === 'string' &&
  /^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/.test(path) &&
  !path.split('/').some((part) => part === '.' || part === '..');
const safeOwner = (owner) =>
  typeof owner === 'string' && /^[A-Za-z0-9+._-]+$/.test(owner);
const digestValue = (value) =>
  typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
const sourceKey = ({ kind, owner, source }) =>
  `${kind}\0${owner}\0${source.sha256}`;
const ordered = (values, key) =>
  values.every(
    (value, index) => index === 0 || key(values[index - 1]) < key(value)
  );
const installPath = (sourcePath, installPrefix, stripComponents) => {
  const stripped = sourcePath.split('/').slice(stripComponents).join('/');
  if (!stripped) return undefined;
  return installPrefix ? `${installPrefix}/${stripped}` : stripped;
};
function digestFile(path, offset = 0, size = undefined) {
  const descriptor = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const before = fstatSync(descriptor);
    if (!before.isFile()) throw new TypeError('invalid rootfs source archive');
    const length = size ?? before.size;
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    for (let cursor = 0; cursor < length; ) {
      const read = readSync(
        descriptor,
        buffer,
        0,
        Math.min(buffer.length, length - cursor),
        offset + cursor
      );
      if (!read) throw new TypeError('truncated rootfs source archive');
      hash.update(buffer.subarray(0, read));
      cursor += read;
    }
    const after = fstatSync(descriptor);
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size
    )
      throw new TypeError('rootfs source archive identity changed');
    return hash.digest('hex');
  } finally {
    closeSync(descriptor);
  }
}
function validSource(record) {
  const { source } = record;
  return record.kind === 'tarball'
    ? exactKeys(source, ['sha256']) && digestValue(source.sha256)
    : exactKeys(source, [
        'architecture',
        'filename',
        'name',
        'sha256',
        'version',
      ]) &&
        source.name === record.owner &&
        source.architecture === 'amd64' &&
        /^[A-Za-z0-9.+_/@:~-]+$/.test(source.filename) &&
        /^[A-Za-z0-9.+:~=-]+$/.test(source.version) &&
        digestValue(source.sha256);
}
export function serializeRootfsSourceMembership(input) {
  if (
    !exactKeys(input, ['schemaVersion', 'sources']) ||
    input.schemaVersion !== 1 ||
    !Array.isArray(input.sources) ||
    !input.sources.length ||
    !ordered(input.sources, sourceKey)
  )
    throw new TypeError('invalid rootfs source membership input');
  const sources = input.sources.map((record) => {
    if (
      !exactKeys(record, [
        'archivePath',
        'candidates',
        'installPrefix',
        'kind',
        'owner',
        'source',
        'sourceArchivePath',
        'stripComponents',
      ]) ||
      !['deb', 'tarball'].includes(record.kind) ||
      !safeOwner(record.owner) ||
      typeof record.archivePath !== 'string' ||
      typeof record.sourceArchivePath !== 'string' ||
      (record.installPrefix !== '' && !safePath(record.installPrefix)) ||
      !Number.isSafeInteger(record.stripComponents) ||
      record.stripComponents < 0 ||
      record.stripComponents > 16 ||
      !Array.isArray(record.candidates) ||
      !record.candidates.length ||
      !ordered(record.candidates, (path) => path) ||
      !record.candidates.every(safePath) ||
      !validSource(record)
    )
      throw new TypeError('invalid rootfs source membership input');
    if (digestFile(record.sourceArchivePath) !== record.source.sha256)
      throw new TypeError('rootfs source archive digest mismatch');
    const members = new Map();
    for (const member of inspectArchive(
      record.archivePath,
      archiveLimits,
      archiveLimits.layerMembers
    )) {
      const installed = installPath(
        member.name,
        record.installPrefix,
        record.stripComponents
      );
      if (!installed) continue;
      if (members.has(installed))
        throw new TypeError('ambiguous rootfs source archive member');
      members.set(installed, member);
    }
    const entries = record.candidates.map((path) => {
      const member = members.get(path);
      if (!member || !['0', '2'].includes(member.type))
        throw new TypeError('missing rootfs source archive member');
      return {
        gid: member.gid,
        linkTarget: member.type === '2' ? member.linkTarget : null,
        mode: member.mode.toString(8).padStart(4, '0'),
        path,
        sourcePath: member.name,
        sha256:
          member.type === '2'
            ? digest(Buffer.from(member.linkTarget))
            : digestFile(record.archivePath, member.offset, member.size),
        type: member.type,
        uid: member.uid,
      };
    });
    return {
      entries,
      installPrefix: record.installPrefix,
      kind: record.kind,
      owner: record.owner,
      source: record.source,
      stripComponents: record.stripComponents,
    };
  });
  return Buffer.from(canonicalJson({ schemaVersion: 1, sources }));
}
if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === 'write'
) {
  const [inputPath, outputPath] = process.argv.slice(3);
  if (!inputPath || !outputPath || process.argv.length !== 5)
    throw new TypeError('invalid rootfs source membership command');
  writeFileSync(
    outputPath,
    serializeRootfsSourceMembership(
      JSON.parse(readFileSync(inputPath, 'utf8'))
    ),
    { mode: 0o444 }
  );
}
