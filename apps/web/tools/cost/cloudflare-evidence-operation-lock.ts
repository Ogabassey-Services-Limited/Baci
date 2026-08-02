import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { lstat, readFile, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tryCreateEvidenceLock } from './cloudflare-evidence-lock-guard';
import { reclaimLockIfOwner } from './cloudflare-evidence-lock-reclamation';
import { RUN_ID_PATTERN } from './cloudflare-evidence-run-journal-state';

const OPERATION_LOCK_TIMEOUT_MS = 60_000;
type LockRecord = Readonly<{
  runId: string;
  pid: number;
  token: string;
  processStartTime: string;
}>;
const operationLockPath = (stateDir: string, runId: string) => {
  if (basename(runId) !== runId || !RUN_ID_PATTERN.test(runId))
    throw new Error('journal run ID is invalid');
  return join(stateDir, `.operation-${runId}.lock`);
};
function processStartTime(pid: number) {
  try {
    return (
      execFileSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
        encoding: 'utf8',
      }).trim() || undefined
    );
  } catch {
    return undefined;
  }
}
const currentProcessStartTime = () => {
  const value = processStartTime(process.pid);
  if (!value) throw new Error('evidence lock owner identity is unavailable');
  return value;
};
const encodeLockRecord = (runId: string, token: string, startTime: string) =>
  `${JSON.stringify({
    runId,
    pid: process.pid,
    token,
    processStartTime: startTime,
  } satisfies LockRecord)}\n`;
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
        processStartTime:
          typeof candidate.processStartTime === 'string'
            ? candidate.processStartTime
            : undefined,
      };
    }
  } catch {
    // A legacy plain run ID can be reclaimed as an unowned lock.
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
function hasDifferentProcessIdentity(owner: Partial<LockRecord>) {
  if (!owner.pid || !owner.processStartTime) return false;
  const observed = processStartTime(owner.pid);
  return observed !== undefined && observed !== owner.processStartTime;
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
async function acquireOperationLock(stateDir: string, runId: string) {
  const path = operationLockPath(stateDir, runId);
  const token = randomUUID();
  const startTime = currentProcessStartTime();
  const deadline = Date.now() + OPERATION_LOCK_TIMEOUT_MS;
  for (;;) {
    if (Date.now() > deadline)
      throw new Error('evidence operation lock wait timed out');
    if (
      await tryCreateEvidenceLock(
        path,
        encodeLockRecord(runId, token, startTime)
      )
    )
      return { path, token };
    let ownerText = '';
    try {
      ownerText = await readLockRecord(path);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
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
    if (
      (!owner.pid && Date.now() - (await stat(path)).mtimeMs >= 5_000) ||
      (owner.pid &&
        (!processIsAlive(owner.pid) || hasDifferentProcessIdentity(owner)))
    ) {
      await reclaimLockIfOwner(path, ownerText);
      continue;
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 5));
  }
}
async function releaseOperationLock(
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
const localOperationQueues = new Map<string, Promise<void>>();

/** Serializes the complete provider mutation/cleanup lifecycle for one run. */
export async function withEvidenceRunOperationLock<T>(
  stateDir: string,
  runId: string,
  operation: () => Promise<T>
): Promise<T> {
  const key = `${stateDir}\0${runId}`;
  const previous = localOperationQueues.get(key);
  let releaseQueue!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseQueue = resolve;
  });
  localOperationQueues.set(key, current);
  if (previous) {
    try {
      await previous;
    } catch (error) {
      releaseQueue();
      if (localOperationQueues.get(key) === current)
        localOperationQueues.delete(key);
      throw error;
    }
  }
  let lock: Readonly<{ path: string; token: string }>;
  try {
    lock = await acquireOperationLock(stateDir, runId);
  } catch (error) {
    releaseQueue();
    if (localOperationQueues.get(key) === current)
      localOperationQueues.delete(key);
    throw error;
  }
  try {
    return await operation();
  } finally {
    try {
      await releaseOperationLock(lock);
    } finally {
      releaseQueue();
      if (localOperationQueues.get(key) === current)
        localOperationQueues.delete(key);
    }
  }
}
