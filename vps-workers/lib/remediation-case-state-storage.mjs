import {
  closeSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname } from 'node:path';

const STALE_LOCK_MS = 2 * 60 * 1_000;

export function createRemediationCaseStateStorage({
  createEmptyState,
  isValidState,
  path,
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
      try {
        const descriptor = openSync(lockPath, 'wx', 0o600);
        try {
          return action(read());
        } finally {
          closeSync(descriptor);
          unlinkSync(lockPath);
        }
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error;
        const modifiedAt = statSync(lockPath, {
          throwIfNoEntry: false,
        })?.mtimeMs;
        if (attempt === 0 && modifiedAt && nowMs - modifiedAt > STALE_LOCK_MS) {
          try {
            unlink(lockPath);
          } catch (cleanupError) {
            if (cleanupError?.code !== 'ENOENT') throw cleanupError;
          }
          continue;
        }
        return fallback;
      }
    }
    return fallback;
  }

  return { persist, read, withLock };
}
