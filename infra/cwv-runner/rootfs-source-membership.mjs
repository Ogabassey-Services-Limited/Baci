import { createHash } from 'node:crypto';
import { canonicalJson } from './canonical-json.mjs';

export const rootfsSourceMembershipPath =
  'opt/baci-cwv/rootfs-source-membership.json';
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
const identityKey = (kind, owner, sourceSha256, path) =>
  `${kind}\0${owner}\0${sourceSha256}\0${path}`;
const sourceKey = ({ kind, owner, source }) =>
  `${kind}\0${owner}\0${source.sha256}`;
const ordered = (values, key) =>
  values.every(
    (value, index) => index === 0 || key(values[index - 1]) < key(value)
  );
const installPath = (sourcePath, installPrefix, stripComponents) => {
  const stripped = sourcePath.split('/').slice(stripComponents).join('/');
  return installPrefix ? `${installPrefix}/${stripped}` : stripped;
};

function parseSource(source, kind, owner, authority) {
  if (kind === 'tarball') {
    if (!exactKeys(source, ['sha256']) || !digestValue(source.sha256))
      throw new TypeError('invalid rootfs source membership source');
    if (authority?.artifactSources?.get(owner) !== source.sha256)
      throw new TypeError('unbound rootfs source membership source');
    return source;
  }
  if (
    !exactKeys(source, [
      'architecture',
      'filename',
      'name',
      'sha256',
      'version',
    ]) ||
    source.name !== owner ||
    source.architecture !== 'amd64' ||
    !/^[A-Za-z0-9.+_/@:~-]+$/.test(source.filename) ||
    !/^[A-Za-z0-9.+:~=-]+$/.test(source.version) ||
    !digestValue(source.sha256) ||
    canonicalJson(authority?.packageSources?.get(owner)) !==
      canonicalJson(source)
  )
    throw new TypeError('unbound rootfs source membership source');
  return source;
}

function parseEntry(entry) {
  if (
    !exactKeys(entry, [
      'gid',
      'linkTarget',
      'mode',
      'path',
      'sha256',
      'sourcePath',
      'type',
      'uid',
    ]) ||
    !safePath(entry.path) ||
    !safePath(entry.sourcePath) ||
    !['0', '2'].includes(entry.type) ||
    !/^[0-7]{4}$/.test(entry.mode) ||
    !Number.isSafeInteger(entry.uid) ||
    entry.uid < 0 ||
    !Number.isSafeInteger(entry.gid) ||
    entry.gid < 0 ||
    !digestValue(entry.sha256) ||
    (entry.type === '0' && entry.linkTarget !== null) ||
    (entry.type === '2' &&
      (typeof entry.linkTarget !== 'string' ||
        !entry.linkTarget ||
        entry.linkTarget.includes('\0') ||
        entry.sha256 !== digest(Buffer.from(entry.linkTarget))))
  )
    throw new TypeError('invalid rootfs source membership entry');
  return entry;
}

export function parseRootfsSourceMembership(bytes, authority) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new TypeError('invalid rootfs source membership');
  }
  if (
    canonicalJson(value) !== Buffer.from(bytes).toString('utf8') ||
    !exactKeys(value, ['schemaVersion', 'sources']) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.sources) ||
    !value.sources.length ||
    !ordered(value.sources, sourceKey)
  )
    throw new TypeError('invalid rootfs source membership');
  const entries = new Map();
  for (const sourceRecord of value.sources) {
    if (
      !exactKeys(sourceRecord, [
        'entries',
        'installPrefix',
        'kind',
        'owner',
        'source',
        'stripComponents',
      ]) ||
      !['deb', 'tarball'].includes(sourceRecord.kind) ||
      !safeOwner(sourceRecord.owner) ||
      (sourceRecord.installPrefix !== '' &&
        !safePath(sourceRecord.installPrefix)) ||
      !Number.isSafeInteger(sourceRecord.stripComponents) ||
      sourceRecord.stripComponents < 0 ||
      sourceRecord.stripComponents > 16 ||
      !Array.isArray(sourceRecord.entries) ||
      !sourceRecord.entries.length ||
      !ordered(sourceRecord.entries, (entry) => entry.path)
    )
      throw new TypeError('invalid rootfs source membership source');
    const source = parseSource(
      sourceRecord.source,
      sourceRecord.kind,
      sourceRecord.owner,
      authority
    );
    for (const entry of sourceRecord.entries) {
      const member = parseEntry(entry);
      if (
        installPath(
          member.sourcePath,
          sourceRecord.installPrefix,
          sourceRecord.stripComponents
        ) !== member.path
      )
        throw new TypeError('rootfs source membership install mismatch');
      const key = identityKey(
        sourceRecord.kind,
        sourceRecord.owner,
        source.sha256,
        member.path
      );
      if (entries.has(key))
        throw new TypeError('duplicate rootfs source membership entry');
      entries.set(key, member);
    }
  }
  return entries;
}

export function packageSourceAuthority(packages) {
  if (!Array.isArray(packages) || !packages.length)
    throw new TypeError('invalid Ubuntu package authority');
  const sources = new Map();
  for (const source of packages) {
    if (
      !exactKeys(source, [
        'architecture',
        'filename',
        'name',
        'sha256',
        'version',
      ]) ||
      !safeOwner(source.name) ||
      source.architecture !== 'amd64' ||
      !/^[A-Za-z0-9.+_/@:~-]+$/.test(source.filename) ||
      !/^[A-Za-z0-9.+:~=-]+$/.test(source.version) ||
      !digestValue(source.sha256) ||
      sources.has(source.name)
    )
      throw new TypeError('invalid Ubuntu package authority');
    sources.set(source.name, Object.freeze({ ...source }));
  }
  return sources;
}

export function validateRootfsSourceMembershipRow(row, membership) {
  const member = membership?.get(
    identityKey(row.kind, row.owner, row.sourceSha256, row.path)
  );
  if (
    !member ||
    canonicalJson({
      gid: member.gid,
      linkTarget: member.linkTarget,
      mode: member.mode,
      path: member.path,
      sha256: member.sha256,
      type: member.type,
      uid: member.uid,
    }) !==
      canonicalJson({
        gid: row.gid,
        linkTarget: row.linkTarget,
        mode: row.mode,
        path: row.path,
        sha256: row.sha256,
        type: row.type,
        uid: row.uid,
      })
  )
    throw new TypeError('rootfs source inventory membership mismatch');
  return row;
}
