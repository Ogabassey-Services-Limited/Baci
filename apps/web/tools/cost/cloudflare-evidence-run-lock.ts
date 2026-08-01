import { open, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';

type LockJournal = Readonly<{ phase: string }>;

export type EvidenceRunLockOptions = Readonly<{
  readJournal: (stateDir: string, runId: string) => Promise<LockJournal>;
  isTerminal: (phase: string) => boolean;
}>;

const activeRunLockPath = (stateDir: string) =>
  join(stateDir, '.active-run.lock');

export async function releaseActiveRunLock(stateDir: string, runId: string) {
  try {
    const owner = (await readFile(activeRunLockPath(stateDir), 'utf8')).trim();
    if (owner === runId) await rm(activeRunLockPath(stateDir));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}

export async function acquireActiveRunLock(
  stateDir: string,
  runId: string,
  options: EvidenceRunLockOptions
) {
  try {
    const lock = await open(activeRunLockPath(stateDir), 'wx', 0o600);
    try {
      await lock.writeFile(`${runId}\n`);
      await lock.sync();
    } finally {
      await lock.close();
    }
    return;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  let owner = '';
  try {
    owner = (await readFile(activeRunLockPath(stateDir), 'utf8')).trim();
  } catch {
    throw new Error('an evidence run is already active');
  }
  if (owner) {
    try {
      const existing = await options.readJournal(stateDir, owner);
      if (options.isTerminal(existing.phase)) {
        await releaseActiveRunLock(stateDir, owner);
        return acquireActiveRunLock(stateDir, runId, options);
      }
    } catch (error) {
      // The journal can be observed after the lock. Never delete the lock in
      // that window, because doing so would admit a concurrent run.
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error('an evidence run is already active');
      }
      throw error;
    }
  }
  throw new Error('an evidence run is already active');
}
