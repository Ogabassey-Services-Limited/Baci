import { randomUUID } from 'node:crypto';
import {
  closeSync,
  linkSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 30_000;
const STALE_LOCK_MS = 60_000;

function readLockSnapshot(lockPath) {
  try {
    const before = statSync(lockPath);
    const contents = readFileSync(lockPath, 'utf8');
    const after = statSync(lockPath);
    if (
      before.dev !== after.dev ||
      before.ino !== after.ino ||
      before.size !== after.size ||
      before.mtimeMs !== after.mtimeMs
    ) {
      return null;
    }
    return {
      contents,
      owner: Number.parseInt(contents, 10),
      stat: after,
    };
  } catch {
    return null;
  }
}

function lockSnapshotIsStale(snapshot) {
  const age = Date.now() - snapshot.stat.mtimeMs;

  if (Number.isSafeInteger(snapshot.owner) && snapshot.owner > 0) {
    try {
      process.kill(snapshot.owner, 0);
      return age >= STALE_LOCK_MS;
    } catch (error) {
      if (error?.code === 'ESRCH') return true;
      if (error?.code === 'EPERM') return age >= STALE_LOCK_MS;
    }
  }

  return age >= STALE_LOCK_MS;
}

function restoreClaimedLock(claimPath, lockPath) {
  try {
    linkSync(claimPath, lockPath);
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
  }
  try {
    unlinkSync(claimPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
}

function reclaimStaleLock(lockPath) {
  const observed = readLockSnapshot(lockPath);
  if (!observed || !lockSnapshotIsStale(observed)) return false;

  const claimPath = `${lockPath}.stale-${process.pid}-${randomUUID()}`;
  try {
    // Rename claims the exact pathname instance that was inspected. A second
    // contender can never unlink a replacement lock through this path.
    renameSync(lockPath, claimPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }

  const claimed = readLockSnapshot(claimPath);
  if (claimed && !lockSnapshotIsStale(claimed)) {
    restoreClaimedLock(claimPath, lockPath);
    return false;
  }
  try {
    unlinkSync(claimPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return true;
}

function waitForLock() {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, LOCK_RETRY_MS);
}

/** Serialize the short active-drain rotation and append critical section. */
export function withDrainFileLock(lockPath, action) {
  mkdirSync(dirname(lockPath), { recursive: true });
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let descriptor;

  while (descriptor === undefined) {
    try {
      descriptor = openSync(lockPath, 'wx', 0o600);
      writeSync(descriptor, `${process.pid}\n`);
      closeSync(descriptor);
    } catch (error) {
      if (descriptor !== undefined) closeSync(descriptor);
      descriptor = undefined;
      if (error?.code !== 'EEXIST') throw error;

      if (reclaimStaleLock(lockPath)) {
        continue;
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for drain lock: ${lockPath}`);
      }
      waitForLock();
    }
  }

  let result;
  let actionError;
  try {
    result = action();
  } catch (error) {
    actionError = error;
  }

  let releaseError;
  try {
    unlinkSync(lockPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') releaseError = error;
  }

  if (actionError) throw actionError;
  if (releaseError) throw releaseError;
  return result;
}
