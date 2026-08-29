import { randomUUID } from 'node:crypto';
import {
  closeSync,
  linkSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';

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

function sameLockIdentity(left, right) {
  return (
    left?.stat?.dev === right?.stat?.dev && left?.stat?.ino === right?.stat?.ino
  );
}

function restoreClaimedLock(claimPath, lockPath, expected) {
  const claimed = readLockSnapshot(claimPath);
  if (!sameLockIdentity(claimed, expected)) return false;
  try {
    const current = statSync(lockPath);
    if (
      current.dev !== expected.stat.dev ||
      current.ino !== expected.stat.ino
    ) {
      return false;
    }
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  let linked = false;
  try {
    linkSync(claimPath, lockPath);
    linked = true;
  } catch (error) {
    if (error?.code !== 'EEXIST') throw error;
    const current = readLockSnapshot(lockPath);
    if (!sameLockIdentity(current, expected)) return false;
  }
  if (!linked && !sameLockIdentity(readLockSnapshot(lockPath), expected)) {
    return false;
  }
  try {
    unlinkSync(claimPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return true;
}

function removeOwnedClaims(lockPath, identity) {
  let entries;
  try {
    entries = readdirSync(dirname(lockPath), { withFileTypes: true });
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  const claimPrefix = `${basename(lockPath)}.stale-`;
  for (const entry of entries) {
    if (!entry.name.startsWith(claimPrefix)) continue;
    const claimPath = join(dirname(lockPath), entry.name);
    try {
      const claim = statSync(claimPath);
      if (claim.dev === identity?.dev && claim.ino === identity?.ino) {
        unlinkSync(claimPath);
      }
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
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
  if (!claimed) return true;
  if (!sameLockIdentity(observed, claimed)) {
    // The pathname changed while it was being claimed. Never delete the
    // replacement; restore it only while its generation is still present.
    restoreClaimedLock(claimPath, lockPath, claimed);
    return false;
  }
  if (!lockSnapshotIsStale(claimed)) {
    restoreClaimedLock(claimPath, lockPath, claimed);
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
  let acquiredIdentity;

  while (descriptor === undefined) {
    try {
      descriptor = openSync(lockPath, 'wx', 0o600);
      writeSync(descriptor, `${process.pid}\n`);
      closeSync(descriptor);
      acquiredIdentity = statSync(lockPath);
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
    const current = statSync(lockPath);
    if (
      current.dev === acquiredIdentity?.dev &&
      current.ino === acquiredIdentity?.ino
    ) {
      unlinkSync(lockPath);
    }
  } catch (error) {
    if (error?.code === 'ENOENT') {
      try {
        removeOwnedClaims(lockPath, acquiredIdentity);
      } catch (claimError) {
        releaseError = claimError;
      }
    } else {
      releaseError = error;
    }
  }

  if (actionError) throw actionError;
  if (releaseError) throw releaseError;
  return result;
}
