import { createHash, randomBytes } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, mkdir, open, rename, rm } from 'node:fs/promises';
import { readRootRuntimeOwnedFile } from './root-runtime-owned-read.mjs';

export const registrationCommandStoreRoot =
  '/srv/baci-cwv/receipts/root-runtime-command';
const ACTIVE = `${registrationCommandStoreRoot}/active`;
export const registrationCompletedCommandRoot = `${registrationCommandStoreRoot}/archive`;
const SHA256 = /^[a-f0-9]{64}\n$/;
const fail = () => {
  throw new TypeError('registration command store refused');
};
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const root = () => {
  if (process.getuid?.() !== 0) fail();
};
const ownedDirectory = (details) =>
  details?.isDirectory?.() &&
  !details.isSymbolicLink?.() &&
  details.uid === 0 &&
  details.gid === 0 &&
  (details.mode & 0o777) === 0o700;
async function requireDirectory(path, stat) {
  const details = await stat(path);
  if (!ownedDirectory(details)) fail();
}

async function requireMissing(path, stat) {
  try {
    await stat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    fail();
  }
  fail();
}

async function writeOwned(path, bytes, openFile) {
  const handle = await openFile(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o400
  );
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function syncDirectory(path, openFile) {
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  try {
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readOwned(path, maximum, stat, openFile) {
  try {
    return await readRootRuntimeOwnedFile(path, maximum, {
      lstat: stat,
      open: openFile,
    });
  } catch {
    fail();
  }
}

export async function publishRegistrationCommand(bytes, dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const makeDirectory = dependencies.mkdir ?? mkdir;
  const openFile = dependencies.open ?? open;
  const move = dependencies.rename ?? rename;
  const remove = dependencies.rm ?? rm;
  const entropy = dependencies.randomBytes ?? randomBytes;
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length < 3 ||
    bytes.length > 16_384 ||
    typeof assertRoot !== 'function' ||
    typeof entropy !== 'function' ||
    typeof remove !== 'function'
  )
    fail();
  assertRoot();
  await makeDirectory(registrationCommandStoreRoot, {
    mode: 0o700,
    recursive: true,
  });
  await requireDirectory(registrationCommandStoreRoot, stat);
  await requireMissing(ACTIVE, stat);
  const nonce = entropy(16);
  if (!Buffer.isBuffer(nonce) || nonce.length !== 16) fail();
  const pending = `${registrationCommandStoreRoot}/pending-${nonce.toString('hex')}`;
  try {
    await makeDirectory(pending, { mode: 0o700 });
    await writeOwned(`${pending}/command.json`, bytes, openFile);
    await writeOwned(
      `${pending}/command.sha256`,
      Buffer.from(`${digest(bytes)}\n`),
      openFile
    );
    await syncDirectory(pending, openFile);
    await requireMissing(ACTIVE, stat);
    await move(pending, ACTIVE);
    await syncDirectory(registrationCommandStoreRoot, openFile);
  } catch (error) {
    try {
      await remove(pending, { force: true, recursive: true });
    } catch {
      // Preserve the publication error: a cleanup error has lower authority.
    }
    throw error instanceof TypeError
      ? error
      : new TypeError('registration command store refused');
  }
}

async function readCommandAt(directory, dependencies) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  if (typeof assertRoot !== 'function') fail();
  assertRoot();
  await requireDirectory(registrationCommandStoreRoot, stat);
  await requireDirectory(directory, stat);
  const [bytes, receipt] = await Promise.all([
    readOwned(`${directory}/command.json`, 16_384, stat, openFile),
    readOwned(`${directory}/command.sha256`, 65, stat, openFile),
  ]);
  const recorded = receipt.toString('utf8');
  if (!SHA256.test(recorded) || digest(bytes) !== recorded.slice(0, -1)) fail();
  return Buffer.from(bytes);
}

export async function readRegistrationCommand(dependencies = {}) {
  return await readCommandAt(ACTIVE, dependencies);
}

export async function readCompletedRegistrationCommand(dependencies = {}) {
  return await readCommandAt(registrationCompletedCommandRoot, dependencies);
}

export async function readRegistrationCommandIfPresent(dependencies = {}) {
  const assertRoot = dependencies.assertRoot ?? root;
  const stat = dependencies.lstat ?? lstat;
  if (typeof assertRoot !== 'function') fail();
  assertRoot();
  try {
    await requireDirectory(registrationCommandStoreRoot, stat);
    await requireDirectory(ACTIVE, stat);
  } catch (error) {
    if (error?.code === 'ENOENT') return undefined;
    throw error;
  }
  return await readRegistrationCommand(dependencies);
}
