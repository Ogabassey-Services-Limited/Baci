import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';

const STALE_LOCK_MS = 2 * 60 * 1_000;

const processIsAlive = (pid) => {
  try { process.kill(pid, 0); return true; } catch (error) { return error?.code !== 'ESRCH'; }
};
const processStartedAt = (pid) => {
  try { return execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], { encoding: 'utf8', timeout: 1_000 }).trim() || null; } catch { return null; }
};

export function createRemediationCaseStateStorage({
  createEmptyState,
  isValidState,
  path,
  processIsAlive: isAlive = processIsAlive,
  processStartedAt: startedAt = processStartedAt,
  unlink = unlinkSync,
}) {
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
      let descriptor;
      const token = randomUUID();
      try {
        descriptor = openSync(lockPath, 'wx', 0o600);
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        let owner;
        try { owner = JSON.parse(readFileSync(lockPath, 'utf8')); } catch { owner = null; }
        const stale = owner && nowMs - Date.parse(owner.createdAt) > STALE_LOCK_MS &&
          (!isAlive(owner.pid) || (typeof owner.processStartedAt === 'string' && startedAt(owner.pid) !== owner.processStartedAt));
        if (attempt === 0 && stale) {
          try {
            unlink(lockPath);
          } catch (cleanupError) {
            if (cleanupError?.code !== 'ENOENT') throw cleanupError;
          }
          continue;
        }
        return fallback;
      }
      writeFileSync(descriptor, JSON.stringify({ createdAt: new Date(nowMs).toISOString(), pid: process.pid, processStartedAt: startedAt(process.pid), token }));
      try {
        return action(read());
      } finally {
        closeSync(descriptor);
        try {
          const owner = JSON.parse(readFileSync(lockPath, 'utf8'));
          if (owner.token === token) unlink(lockPath);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
    }
    return fallback;
  }

  return { persist, read, withLock };
}
