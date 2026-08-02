import { createHash, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, rename, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalJson, validateSourceEnvelope } from './host-attestation.mjs';

const SOURCES = new Set([
  'github',
  'host',
  'image',
  'policy',
  'runtime',
  'service',
]);
const EVIDENCE_FILE = /^[a-z][a-z0-9-]*(?:\.(?:json|sha256))?$/;
export const EVIDENCE_UID = 0;
export const EVIDENCE_GID = 10001;
export const EVIDENCE_MODE = 0o640;
export const EVIDENCE_DIRECTORY_MODE = 0o750;

function fail(message) {
  throw new Error(`attestation evidence refused: ${message}`);
}

function sourceName(name) {
  if (!SOURCES.has(name)) fail('unknown source');
  return name;
}

function evidenceFileName(name) {
  if (!EVIDENCE_FILE.test(name)) fail('invalid evidence file name');
  return name;
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeDetails(details, { uid, gid, mode, directory = false }) {
  if (
    (directory ? !details.isDirectory() : !details.isFile()) ||
    details.isSymbolicLink() ||
    details.uid !== uid ||
    details.gid !== gid ||
    (details.mode & 0o777) !== mode
  )
    fail('unsafe evidence metadata');
}

export function assertEvidenceDirectoryDetails(
  details,
  { uid = EVIDENCE_UID, gid = EVIDENCE_GID } = {}
) {
  try {
    safeDetails(details, {
      directory: true,
      gid,
      mode: EVIDENCE_DIRECTORY_MODE,
      uid,
    });
  } catch {
    fail('private evidence directory required');
  }
}

async function notify(onOperation, operation) {
  await onOperation?.(operation);
}

async function openSafeDirectory(root, uid, gid) {
  const before = await lstat(root);
  safeDetails(before, {
    directory: true,
    gid,
    mode: EVIDENCE_DIRECTORY_MODE,
    uid,
  });
  const handle = await open(
    root,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    const after = await handle.stat();
    safeDetails(after, {
      directory: true,
      gid,
      mode: EVIDENCE_DIRECTORY_MODE,
      uid,
    });
    if (before.dev !== after.dev || before.ino !== after.ino)
      fail('evidence directory identity changed');
    return handle;
  } catch (error) {
    await handle.close();
    throw error;
  }
}

function pathRelativeToDirectory(handle, name, relativePath) {
  if (relativePath) return relativePath(handle, name);
  if (process.platform !== 'linux')
    fail('directory-relative evidence access requires Linux');
  return `/proc/self/fd/${handle.fd}/${name}`;
}

async function withSafeDirectory(root, options, operation) {
  const { gid = EVIDENCE_GID, onOperation, uid = EVIDENCE_UID } = options;
  const handle = await openSafeDirectory(root, uid, gid);
  try {
    await notify(onOperation, 'directory-open');
    return await operation({
      gid,
      handle,
      onOperation,
      pathFor: (name) =>
        pathRelativeToDirectory(handle, name, options.relativePath),
      uid,
    });
  } finally {
    await handle.close();
  }
}

async function readNoFollow(directory, name) {
  const path = directory.pathFor(name);
  const fileDetails = { ...directory, mode: EVIDENCE_MODE };
  await notify(directory.onOperation, 'readback-lstat');
  const before = await lstat(path);
  safeDetails(before, fileDetails);
  await notify(directory.onOperation, 'readback-open');
  const handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const after = await handle.stat();
    safeDetails(after, fileDetails);
    if (before.dev !== after.dev || before.ino !== after.ino)
      fail('evidence identity changed');
    await notify(directory.onOperation, 'readback-read');
    return await handle.readFile();
  } finally {
    await handle.close();
  }
}

async function safePrior(directory, name) {
  try {
    await notify(directory.onOperation, 'prior-lstat');
    safeDetails(await lstat(directory.pathFor(name)), {
      ...directory,
      mode: EVIDENCE_MODE,
    });
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

async function atomicFile(directory, name, bytes) {
  await safePrior(directory, name);
  const fileDetails = { ...directory, mode: EVIDENCE_MODE };
  const temporaryName = `.${name}-${process.pid}-${randomUUID()}`;
  const temporaryPath = directory.pathFor(temporaryName);
  let handle;
  try {
    await notify(directory.onOperation, 'temporary-open');
    handle = await open(
      temporaryPath,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600
    );
    try {
      await notify(directory.onOperation, 'temporary-write');
      await handle.writeFile(bytes);
      await notify(directory.onOperation, 'temporary-chown');
      await handle.chown(directory.uid, directory.gid);
      await notify(directory.onOperation, 'temporary-chmod');
      await handle.chmod(EVIDENCE_MODE);
      await notify(directory.onOperation, 'temporary-fsync');
      await handle.sync();
      safeDetails(await handle.stat(), fileDetails);
    } finally {
      await handle.close();
      handle = undefined;
    }
    safeDetails(await lstat(temporaryPath), fileDetails);
    await notify(directory.onOperation, 'rename');
    await rename(temporaryPath, directory.pathFor(name));
    const persisted = await readNoFollow(directory, name);
    if (!persisted.equals(bytes)) fail('persisted evidence drift');
    await notify(directory.onOperation, 'directory-fsync');
    await directory.handle.sync();
    return { bytes: persisted, sha256: sha256(persisted) };
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await unlink(temporaryPath).catch(() => undefined);
    throw error;
  }
}

export async function publishEvidenceFile(root, name, bytes, options = {}) {
  evidenceFileName(name);
  if (!Buffer.isBuffer(bytes)) fail('evidence bytes required');
  const result = await withSafeDirectory(root, options, (directory) =>
    atomicFile(directory, name, bytes)
  );
  return { path: join(root, name), ...result };
}

export async function publishSourceEvidence(
  root,
  name,
  envelope,
  options = {}
) {
  sourceName(name);
  validateSourceEnvelope(name, envelope);
  const bytes = Buffer.from(canonicalJson(envelope));
  const digest = Buffer.from(`${sha256(bytes)}\n`);
  await withSafeDirectory(root, options, async (directory) => {
    // The receipt is durable first; the canonical JSON rename is the commit point.
    await atomicFile(directory, `${name}.sha256`, digest);
    await atomicFile(directory, `${name}.json`, bytes);
  });
  return { path: join(root, `${name}.json`), sha256: digest.toString().trim() };
}

export async function readSourceEvidence(root, name, options = {}) {
  sourceName(name);
  return await withSafeDirectory(root, options, async (directory) => {
    const bytes = await readNoFollow(directory, `${name}.json`);
    const receipt = await readNoFollow(directory, `${name}.sha256`);
    const receiptText = receipt.toString('utf8');
    if (!/^[a-f0-9]{64}\n$/.test(receiptText)) fail('invalid evidence receipt');
    if (sha256(bytes) !== receiptText.slice(0, -1))
      fail('evidence digest drift');
    let envelope;
    try {
      envelope = JSON.parse(bytes.toString('utf8'));
    } catch {
      fail('invalid evidence JSON');
    }
    if (canonicalJson(envelope) !== bytes.toString('utf8'))
      fail('noncanonical evidence');
    validateSourceEnvelope(name, envelope);
    return envelope;
  });
}
