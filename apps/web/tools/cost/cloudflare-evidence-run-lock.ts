import { randomUUID } from 'node:crypto';
import { lstat, open, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { reclaimLockIfOwner } from './cloudflare-evidence-lock-reclamation';

type LockJournal = Readonly<{ phase: string }>;
const RUN_ID_PATTERN = /^[a-f0-9]{32}$/;

export type EvidenceRunLockOptions = Readonly<{
  readJournal: (stateDir: string, runId: string) => Promise<LockJournal>;
  isTerminal: (phase: string) => boolean;
}>;

const activeRunLockPath = (stateDir: string) =>
  join(stateDir, '.active-run.lock');
const transitionLockPath = (stateDir: string, runId: string) => {
  if (basename(runId) !== runId || !RUN_ID_PATTERN.test(runId))
    throw new Error('journal run ID is invalid');
  return join(stateDir, `.journal-${runId}.lock`);
};

type LockRecord = Readonly<{
  runId: string;
  pid: number;
  token: string;
}>;

const encodeLockRecord = (runId: string, token: string) =>
  `${JSON.stringify({ runId, pid: process.pid, token } satisfies LockRecord)}\n`;

function parseLockRecord(value: string): Partial<LockRecord> {
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed && typeof parsed === 'object') {
      const candidate = parsed as Record<string, unknown>;
      return {
        runId:
          typeof candidate.runId === 'string' ? candidate.runId : undefined,
        pid: typeof candidate.pid === 'number' ? candidate.pid : undefined,
        token:
          typeof candidate.token === 'string' ? candidate.token : undefined,
      };
    }
  } catch {
    // Older journals used the plain run ID as the owner record. Keep parsing
    // that form so a stale pre-upgrade lock can be reclaimed safely.
  }
  return { runId: value.trim() };
}

function processIsAlive(pid: number | undefined) {
  if (!Number.isInteger(pid) || (pid as number) <= 0) return false;
  try {
    process.kill(pid as number, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code === 'EPERM';
  }
}

async function readLockRecord(path: string) {
  const lockStat = await lstat(path);
  if (
    lockStat.isSymbolicLink() ||
    !lockStat.isFile() ||
    (lockStat.mode & 0o077) !== 0
  )
    throw new Error('evidence lock is not private regular storage');
  return readFile(path, 'utf8');
}

const localTransitionQueues = new Map<string, Promise<void>>();

async function acquireTransitionLock(stateDir: string, runId: string) {
  const path = transitionLockPath(stateDir, runId);
  const token = randomUUID();
  for (;;) {
    try {
      const handle = await open(path, 'wx', 0o600);
      try {
        await handle.writeFile(encodeLockRecord(runId, token));
        await handle.sync();
      } finally {
        await handle.close();
      }
      return { path, token };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
    }

    let ownerText = '';
    try {
      ownerText = await readLockRecord(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    // The creator can briefly expose the lock file before its first write.
    // Treat an empty record as in-flight rather than reclaiming it as a dead
    // owner; otherwise a competing process could enter during that window.
    if (!ownerText.trim()) {
      const lockStat = await stat(path);
      if (Date.now() - lockStat.mtimeMs >= 5_000) {
        await reclaimLockIfOwner(path, ownerText);
        continue;
      }
      await new Promise<void>((resolve) => setTimeout(resolve, 5));
      continue;
    }
    const owner = parseLockRecord(ownerText);
    if (!owner.pid) {
      const lockStat = await stat(path);
      if (Date.now() - lockStat.mtimeMs < 5_000) {
        await new Promise<void>((resolve) => setTimeout(resolve, 5));
        continue;
      }
      await reclaimLockIfOwner(path, ownerText);
      continue;
    }
    if (!processIsAlive(owner.pid)) {
      await reclaimLockIfOwner(path, ownerText);
      continue;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}

async function releaseTransitionLock(
  lock: Readonly<{ path: string; token: string }>
) {
  try {
    const ownerText = await readLockRecord(lock.path);
    if (parseLockRecord(ownerText).token === lock.token)
      await reclaimLockIfOwner(lock.path, ownerText);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

/**
 * Serializes one run's read-modify-write transition across threads/processes.
 * The PID-bearing lock can be reclaimed after a crashed transition, while the
 * in-process queue avoids busy waiting when two calls share one event loop.
 */
export async function withEvidenceRunTransitionLock<T>(
  stateDir: string,
  runId: string,
  transition: () => Promise<T>
): Promise<T> {
  const key = `${stateDir}\0${runId}`;
  const previous = localTransitionQueues.get(key);
  let releaseQueue!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  localTransitionQueues.set(key, current);
  if (previous) {
    try {
      await previous;
    } catch (error) {
      releaseQueue();
      if (localTransitionQueues.get(key) === current)
        localTransitionQueues.delete(key);
      throw error;
    }
  }
  let lock: Readonly<{ path: string; token: string }>;
  try {
    lock = await acquireTransitionLock(stateDir, runId);
  } catch (error) {
    releaseQueue();
    if (localTransitionQueues.get(key) === current)
      localTransitionQueues.delete(key);
    throw error;
  }
  try {
    return await transition();
  } finally {
    await releaseTransitionLock(lock);
    releaseQueue();
    if (localTransitionQueues.get(key) === current)
      localTransitionQueues.delete(key);
  }
}

export async function releaseActiveRunLock(stateDir: string, runId: string) {
  try {
    const path = activeRunLockPath(stateDir);
    const ownerText = await readFile(path, 'utf8');
    const owner = parseLockRecord(ownerText);
    if (owner.runId === runId) await reclaimLockIfOwner(path, ownerText);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function acquireActiveRunLock(
  stateDir: string,
  runId: string,
  options: EvidenceRunLockOptions
) {
  if (basename(runId) !== runId || !RUN_ID_PATTERN.test(runId))
    throw new Error('journal run ID is invalid');
  try {
    const path = activeRunLockPath(stateDir);
    const token = randomUUID();
    const lock = await open(path, 'wx', 0o600);
    try {
      await lock.writeFile(encodeLockRecord(runId, token));
      await lock.sync();
    } finally {
      await lock.close();
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  let ownerText = '';
  try {
    ownerText = await readLockRecord(activeRunLockPath(stateDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT')
      throw new Error('an evidence run is already active');
    throw error;
  }
  const owner = parseLockRecord(ownerText);
  if (!ownerText.trim()) {
    const lockStat = await stat(activeRunLockPath(stateDir));
    if (Date.now() - lockStat.mtimeMs < 5_000)
      throw new Error('an evidence run is already active');
    await reclaimLockIfOwner(activeRunLockPath(stateDir), ownerText);
    return acquireActiveRunLock(stateDir, runId, options);
  }
  if (owner.runId) {
    try {
      const existing = await options.readJournal(stateDir, owner.runId);
      if (options.isTerminal(existing.phase)) {
        await releaseActiveRunLock(stateDir, owner.runId);
        return acquireActiveRunLock(stateDir, runId, options);
      }
    } catch (error) {
      // The journal can be observed after the lock. Never delete the lock in
      // that window, because doing so would admit a concurrent run.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // A structured owner that has exited before persisting its journal is
        // an orphaned preparation lock. Plain legacy records are also safe to
        // reclaim because new owners always persist a PID-bearing record.
        if (!owner.pid || !processIsAlive(owner.pid)) {
          await reclaimLockIfOwner(activeRunLockPath(stateDir), ownerText);
          return acquireActiveRunLock(stateDir, runId, options);
        }
        throw new Error('an evidence run is already active');
      }
      throw error;
    }
  }
  throw new Error('an evidence run is already active');
}
