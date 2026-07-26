import { randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, rename, unlink } from 'node:fs/promises';

import { canonicalJson } from './canonical-json.mjs';

export const registrationRetryBlockPath =
  '/srv/baci-cwv/receipts/registration-retry-block.json';
const ROOT = '/srv/baci-cwv/receipts';
const SHA256 = /^[a-f0-9]{64}$/;
const fail = () => {
  throw new TypeError('registration retry block refused');
};
const root = () => {
  if (process.getuid?.() !== 0) fail();
};
const directory = (details) =>
  details?.isDirectory?.() &&
  !details.isSymbolicLink?.() &&
  details.uid === 0 &&
  details.gid === 0 &&
  (details.mode & 0o777) === 0o700;
const file = (details) =>
  details?.isFile?.() &&
  !details.isSymbolicLink?.() &&
  details.uid === 0 &&
  details.gid === 0 &&
  (details.mode & 0o777) === 0o400 &&
  details.size >= 3 &&
  details.size <= 1_024;
const exact = (value) =>
  value !== null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join(',') ===
    'campaignId,cleanupSha256,commandSha256,disposition,egressReleaseSha256,schemaVersion';

function value(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 3 || bytes.length > 1_024)
    fail();
  let parsed;
  try {
    parsed = JSON.parse(bytes.toString('utf8'));
  } catch {
    fail();
  }
  if (
    !exact(parsed) ||
    parsed.schemaVersion !== 1 ||
    !/^[a-z0-9][a-z0-9-]{0,62}$/.test(parsed.campaignId) ||
    !SHA256.test(parsed.commandSha256) ||
    !SHA256.test(parsed.egressReleaseSha256) ||
    !SHA256.test(parsed.cleanupSha256) ||
    parsed.disposition !== 'owner-row-deletion-required' ||
    canonicalJson(parsed) !== bytes.toString('utf8')
  )
    fail();
  return Object.freeze(parsed);
}

async function ownedDirectory(stat) {
  if (!directory(await stat(ROOT))) fail();
}

async function read(stat, openFile) {
  const before = await stat(registrationRetryBlockPath);
  if (!file(before)) fail();
  const handle = await openFile(
    registrationRetryBlockPath,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const after = await handle.stat();
    if (!file(after) || before.dev !== after.dev || before.ino !== after.ino)
      fail();
    return value(await handle.readFile());
  } finally {
    await handle.close();
  }
}

export async function readRegistrationRetryBlock(dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  if (typeof assertRoot !== 'function') fail();
  assertRoot();
  await ownedDirectory(stat);
  try {
    return await read(stat, openFile);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error instanceof TypeError
      ? error
      : new TypeError('registration retry block refused');
  }
}

export async function publishRegistrationRetryBlock(input, dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const move = dependencies.rename ?? rename;
  const remove = dependencies.unlink ?? unlink;
  const entropy = dependencies.randomBytes ?? randomBytes;
  if (typeof assertRoot !== 'function' || typeof entropy !== 'function') fail();
  assertRoot();
  const bytes = Buffer.from(canonicalJson(input));
  const expected = value(bytes);
  await ownedDirectory(stat);
  try {
    const existing = await read(stat, openFile);
    if (canonicalJson(existing) !== bytes.toString('utf8')) fail();
    return existing;
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  const nonce = entropy(16);
  if (!Buffer.isBuffer(nonce) || nonce.length !== 16) fail();
  const temporary = `${ROOT}/.registration-retry-block-${nonce.toString('hex')}`;
  let handle;
  try {
    handle = await openFile(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o400
    );
    await handle.writeFile(bytes);
    await handle.chown(0, 0);
    await handle.chmod(0o400);
    await handle.sync();
    if (!file(await handle.stat())) fail();
    await handle.close();
    handle = undefined;
    await move(temporary, registrationRetryBlockPath);
    const published = await read(stat, openFile);
    if (canonicalJson(published) !== bytes.toString('utf8')) fail();
    const parent = await openFile(
      ROOT,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
    );
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
    return expected;
  } catch (error) {
    await handle?.close().catch(() => undefined);
    await remove(temporary).catch(() => undefined);
    throw error instanceof TypeError
      ? error
      : new TypeError('registration retry block refused');
  }
}
