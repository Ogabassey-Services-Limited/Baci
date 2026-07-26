import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
  readlinkSync,
  writeFileSync,
} from 'node:fs';
import { fileURLToPath } from 'node:url';

import { canonicalJson } from './canonical-json.mjs';
import { validateRootfsSourceMembershipRow } from './rootfs-source-membership.mjs';

export const rootfsSourceInventoryPath =
  'opt/baci-cwv/rootfs-source-inventory.json';
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
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
const mode = (stat) => (stat.mode & 0o7777).toString(8).padStart(4, '0');

function sourceRow(candidate, root) {
  const absolute = `${root}/${candidate.path}`.replace('//', '/');
  const stat = lstatSync(absolute);
  let type;
  let digest;
  let linkTarget = null;
  if (stat.isSymbolicLink()) {
    type = '2';
    linkTarget = readlinkSync(absolute);
    digest = sha256(Buffer.from(linkTarget));
  } else if (stat.isFile()) {
    type = '0';
    let descriptor;
    try {
      descriptor = openSync(
        absolute,
        constants.O_RDONLY | constants.O_NOFOLLOW
      );
      const opened = fstatSync(descriptor);
      if (
        !opened.isFile() ||
        opened.dev !== stat.dev ||
        opened.ino !== stat.ino
      )
        throw new TypeError('rootfs source identity changed');
      digest = sha256(readFileSync(descriptor));
    } finally {
      if (descriptor !== undefined) closeSync(descriptor);
    }
  } else throw new TypeError('invalid rootfs source member');
  return {
    gid: stat.gid,
    kind: candidate.kind,
    linkTarget,
    mode: mode(stat),
    owner: candidate.owner,
    path: candidate.path,
    sha256: digest,
    sourceSha256: candidate.sourceSha256,
    type,
    uid: stat.uid,
  };
}

function parseCandidate(line) {
  const [kind, owner, sourceSha256, path, ...extra] = line.split('\t');
  if (
    extra.length ||
    !['base-image', 'deb', 'tarball'].includes(kind) ||
    !safeOwner(owner) ||
    !/^[0-9a-f]{64}$/.test(sourceSha256 ?? '') ||
    !safePath(path)
  )
    throw new TypeError('invalid rootfs source candidate');
  return { kind, owner, path, sourceSha256 };
}

export function serializeRootfsSourceInventory(candidateBytes, root = '') {
  const lines = Buffer.from(candidateBytes).toString('utf8').trim().split('\n');
  if (!lines[0]) throw new TypeError('empty rootfs source inventory');
  const candidates = lines.map(parseCandidate);
  candidates.sort((left, right) =>
    left.path < right.path ? -1 : left.path > right.path ? 1 : 0
  );
  const rows = [];
  for (const candidate of candidates) {
    const row = sourceRow(candidate, root);
    const prior = rows.at(-1);
    if (prior?.path === row.path) {
      if (canonicalJson(prior) !== canonicalJson(row))
        throw new TypeError('conflicting rootfs source authority');
      continue;
    }
    rows.push(row);
  }
  return Buffer.from(canonicalJson({ entries: rows, schemaVersion: 1 }));
}

export function parseRootfsSourceInventory(bytes, authority) {
  let value;
  try {
    value = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new TypeError('invalid rootfs source inventory');
  }
  if (
    canonicalJson(value) !== Buffer.from(bytes).toString('utf8') ||
    !exactKeys(value, ['entries', 'schemaVersion']) ||
    value.schemaVersion !== 1 ||
    !Array.isArray(value.entries) ||
    !value.entries.length
  )
    throw new TypeError('invalid rootfs source inventory');
  const entries = new Map();
  for (const row of value.entries) {
    if (
      !exactKeys(row, [
        'gid',
        'kind',
        'linkTarget',
        'mode',
        'owner',
        'path',
        'sha256',
        'sourceSha256',
        'type',
        'uid',
      ]) ||
      !safePath(row.path) ||
      !safeOwner(row.owner) ||
      !['base-image', 'deb', 'tarball'].includes(row.kind) ||
      !['0', '2'].includes(row.type) ||
      !/^[0-7]{4}$/.test(row.mode) ||
      !Number.isSafeInteger(row.uid) ||
      row.uid < 0 ||
      !Number.isSafeInteger(row.gid) ||
      row.gid < 0 ||
      !/^[0-9a-f]{64}$/.test(row.sha256) ||
      !/^[0-9a-f]{64}$/.test(row.sourceSha256) ||
      (row.type === '0' && row.linkTarget !== null) ||
      (row.type === '2' &&
        (typeof row.linkTarget !== 'string' ||
          !row.linkTarget ||
          row.linkTarget.includes('\0') ||
          row.sha256 !== sha256(Buffer.from(row.linkTarget)))) ||
      entries.has(row.path)
    )
      throw new TypeError('invalid rootfs source inventory row');
    const packageSource = authority.packageSources.get(row.owner);
    const authorized =
      (row.kind === 'base-image' &&
        row.sourceSha256 === authority.baseImageSha256) ||
      (row.kind === 'deb' &&
        (typeof packageSource === 'string'
          ? packageSource
          : packageSource?.sha256) === row.sourceSha256) ||
      (row.kind === 'tarball' &&
        authority.artifactSources.get(row.owner) === row.sourceSha256);
    if (!authorized) throw new TypeError('unbound rootfs source inventory row');
    if (authority.membership && row.kind === 'base-image')
      throw new TypeError('unproven base-image rootfs source row');
    if (authority.membership)
      validateRootfsSourceMembershipRow(row, authority.membership);
    entries.set(row.path, row);
  }
  return entries;
}

if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === 'write'
) {
  const [candidatePath, outputPath, root = ''] = process.argv.slice(3);
  if (!candidatePath || !outputPath || process.argv.length > 6)
    throw new TypeError('invalid rootfs source inventory command');
  writeFileSync(
    outputPath,
    serializeRootfsSourceInventory(readFileSync(candidatePath), root),
    { mode: 0o444 }
  );
}
