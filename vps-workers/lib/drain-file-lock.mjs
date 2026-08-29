import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeSync,
} from 'node:fs';
import { dirname } from 'node:path';

const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 30_000;
const STALE_LOCK_MS = 60_000;

function ownerIsAlive(lockPath) {
  let owner;
  try {
    owner = Number.parseInt(readFileSync(lockPath, 'utf8'), 10);
  } catch {
    owner = 0;
  }

  if (Number.isSafeInteger(owner) && owner > 0) {
    try {
      process.kill(owner, 0);
      return true;
    } catch (error) {
      if (error?.code === 'EPERM') return true;
    }
  }

  try {
    return Date.now() - statSync(lockPath).mtimeMs < STALE_LOCK_MS;
  } catch (error) {
    return error?.code !== 'ENOENT';
  }
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

      if (!ownerIsAlive(lockPath)) {
        try {
          unlinkSync(lockPath);
        } catch (unlinkError) {
          if (unlinkError?.code !== 'ENOENT') throw unlinkError;
        }
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
