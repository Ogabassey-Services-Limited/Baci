import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  linkSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const STALE_LOCK_MS = 2 * 60 * 1_000;
const LOCK_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const processIsAlive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error?.code !== 'ESRCH';
  }
};
const processStartedAt = (pid) => {
  try {
    return (
      execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
        encoding: 'utf8',
        timeout: 1_000,
      }).trim() || null
    );
  } catch {
    return null;
  }
};

const completeOwner = (owner) =>
  owner &&
  Number.isSafeInteger(owner.pid) &&
  owner.pid > 0 &&
  typeof owner.createdAt === 'string' &&
  Number.isFinite(Date.parse(owner.createdAt)) &&
  typeof owner.token === 'string' &&
  LOCK_TOKEN_PATTERN.test(owner.token);

const readLockOwner = (lockPath) => {
  try {
    return JSON.parse(readFileSync(lockPath, 'utf8'));
  } catch {
    return null;
  }
};

const sameLockOwner = (expected, current) =>
  completeOwner(expected)
    ? current?.token === expected.token
    : !completeOwner(current);

function reclaimStaleLock({ lockPath, owner, ownerPath, unlink }) {
  const claimPath = `${lockPath}.reclaim-${
    completeOwner(owner) ? owner.token : 'ownerless'
  }`;
  try {
    linkSync(ownerPath, claimPath);
  } catch (error) {
    if (error?.code === 'EEXIST') return false;
    throw error;
  }
  let reclaimed = false;
  let reclaimError;
  try {
    if (sameLockOwner(owner, readLockOwner(lockPath))) {
      try {
        unlink(lockPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      if (completeOwner(owner)) {
        try {
          unlink(`${lockPath}.owner-${owner.token}`);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
      reclaimed = true;
    }
  } catch (error) {
    reclaimError = error;
  }
  try {
    unlink(claimPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') reclaimError ||= error;
  }
  if (reclaimError) throw reclaimError;
  return reclaimed;
}

export function createRemediationCaseStateStorage({
  createEmptyState,
  isValidState,
  path,
  processIsAlive: isAlive = processIsAlive,
  processStartedAt: startedAt = processStartedAt,
  unlink = unlinkSync,
}) {
  const localProcessStartedAt = startedAt(process.pid);

  function read() {
    let content;
    try {
      content = readFileSync(path, 'utf8');
    } catch (error) {
      if (error?.code === 'ENOENT') return createEmptyState();
      throw new Error(`Unable to read remediation case state at ${path}`, {
        cause: error,
      });
    }
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (error) {
      throw new Error(`Invalid remediation case state at ${path}`, {
        cause: error,
      });
    }
    if (!isValidState(parsed)) {
      throw new Error(`Invalid remediation case state at ${path}`);
    }
    return parsed;
  }

  function persist(state) {
    mkdirSync(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      mode: 0o600,
    });
    try {
      renameSync(temporaryPath, path);
    } catch (error) {
      try {
        unlink(temporaryPath);
      } catch (cleanupError) {
        if (cleanupError?.code !== 'ENOENT') throw cleanupError;
      }
      throw error;
    }
  }

  function withLock(nowMs, fallback, action) {
    const lockPath = `${path}.lock`;
    mkdirSync(dirname(path), { recursive: true });
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const token = randomUUID();
      const ownerPath = `${lockPath}.owner-${token}`;
      writeFileSync(
        ownerPath,
        JSON.stringify({
          createdAt: new Date(nowMs).toISOString(),
          pid: process.pid,
          processStartedAt: localProcessStartedAt,
          token,
        }),
        { flag: 'wx', mode: 0o600 }
      );
      try {
        linkSync(ownerPath, lockPath);
      } catch (error) {
        if (error?.code !== 'EEXIST') {
          try {
            unlink(ownerPath);
          } catch (cleanupError) {
            if (cleanupError?.code !== 'ENOENT') throw cleanupError;
          }
          throw error;
        }
        const owner = readLockOwner(lockPath);
        const modifiedAt = statSync(lockPath, {
          throwIfNoEntry: false,
        })?.mtimeMs;
        let stale = false;
        if (
          completeOwner(owner) &&
          nowMs - Date.parse(owner.createdAt) > STALE_LOCK_MS
        ) {
          if (!isAlive(owner.pid)) {
            stale = true;
          } else if (typeof owner.processStartedAt === 'string') {
            const currentProcessStartedAt = startedAt(owner.pid);
            stale =
              typeof currentProcessStartedAt === 'string' &&
              currentProcessStartedAt !== owner.processStartedAt;
          }
        } else if (!completeOwner(owner)) {
          stale =
            Number.isFinite(modifiedAt) && nowMs - modifiedAt > STALE_LOCK_MS;
        }
        if (
          attempt === 0 &&
          stale &&
          reclaimStaleLock({ lockPath, owner, ownerPath, unlink })
        ) {
          continue;
        }
        try {
          unlink(ownerPath);
        } catch (cleanupError) {
          if (cleanupError?.code !== 'ENOENT') throw cleanupError;
        }
        return fallback;
      }
      let result;
      let actionError;
      try {
        result = action(read());
      } catch (error) {
        actionError = error;
      }
      let releaseError;
      let owner;
      let ownerContent;
      try {
        ownerContent = readFileSync(lockPath, 'utf8');
      } catch (error) {
        if (error?.code !== 'ENOENT') releaseError = error;
      }
      if (ownerContent !== undefined) {
        try {
          owner = JSON.parse(ownerContent);
        } catch {
          owner = null;
        }
      }
      if (owner?.token === token) {
        try {
          unlink(lockPath);
        } catch (error) {
          if (error?.code !== 'ENOENT') releaseError ||= error;
        }
      }
      try {
        unlink(ownerPath);
      } catch (error) {
        if (error?.code !== 'ENOENT' && !releaseError) releaseError = error;
      }
      if (actionError) throw actionError;
      if (releaseError) throw releaseError;
      return result;
    }
    return fallback;
  }

  return { persist, read, withLock };
}
