import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import * as fs from 'node:fs/promises';
import path from 'node:path';

const delay = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

async function assertPrivateLock(handle) {
  const details = await handle.stat();
  if (
    !details.isFile() ||
    details.uid !== process.getuid() ||
    (details.mode & 0o077) !== 0
  )
    throw new Error('unsafe journal lock');
}

function sameLock(left, right) {
  return left.dev === right.dev && left.ino === right.ino;
}

async function readLock(lock) {
  const before = await fs.lstat(lock);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== process.getuid() ||
    (before.mode & 0o077) !== 0
  )
    throw new Error('unsafe journal lock');
  let owner;
  try {
    owner = JSON.parse(await fs.readFile(lock, 'utf8'));
  } catch {
    return undefined;
  }
  const after = await fs.lstat(lock);
  if (!sameLock(before, after)) return undefined;
  if (
    !Number.isSafeInteger(owner?.pid) ||
    owner.pid <= 1 ||
    !/^[a-f0-9-]{36}$/.test(owner.token ?? '')
  )
    return undefined;
  return { details: after, owner };
}

async function readCurrentLock(lock) {
  try {
    return await readLock(lock);
  } catch (error) {
    if (error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function releaseHeldLock(lock, held) {
  try {
    const current = await readCurrentLock(lock);
    if (
      !current ||
      !sameLock(current.details, held.details) ||
      current.owner.token !== held.owner.token
    )
      return false;
    // Only the lock owner releases a live lock. Stale lock recovery is
    // deliberately operator-mediated: Node has no conditional inode rename.
    await fs.rm(lock, { force: false });
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
  return true;
}

function lockOwnerIsAlive(owner) {
  try {
    process.kill(owner.pid, 0);
    return true;
  } catch (error) {
    return error.code !== 'ESRCH';
  }
}

async function acquire(directory, fileSystem = fs) {
  const lock = path.join(directory, '.journal.lock');
  for (let attempt = 0; attempt < 200; attempt += 1) {
    let handle;
    try {
      handle = await fileSystem.open(
        lock,
        constants.O_CREAT |
          constants.O_EXCL |
          constants.O_WRONLY |
          constants.O_NOFOLLOW,
        0o600
      );
      await assertPrivateLock(handle);
      const owner = { pid: process.pid, token: randomUUID() };
      await handle.writeFile(JSON.stringify(owner));
      await handle.sync();
      const held = await readLock(lock);
      if (!held || held.owner.token !== owner.token)
        throw new Error('journal lock disappeared during acquisition');
      return { handle, held, lock };
    } catch (error) {
      if (handle) await handle.close();
      if (error.code !== 'EEXIST') throw error;
      try {
        await readLock(lock);
      } catch (inspectionError) {
        if (inspectionError.code === 'ENOENT') continue;
        throw inspectionError;
      }
      const held = await readCurrentLock(lock);
      if (!held) continue;
      if (!lockOwnerIsAlive(held.owner))
        throw new Error(
          'stale journal lock requires operator recovery; automatic removal is unsafe'
        );
      await delay(5);
    }
  }
  throw new Error('journal lock timeout');
}

export async function withJournalLock(directory, operation, fileSystem = fs) {
  const { handle, held, lock } = await acquire(directory, fileSystem);
  try {
    return await operation();
  } finally {
    await handle.close();
    await releaseHeldLock(lock, held);
    const parent = await fs.open(directory, 'r');
    try {
      await parent.sync();
    } finally {
      await parent.close();
    }
  }
}
