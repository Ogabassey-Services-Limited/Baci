import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import {
  lstat,
  mkdir,
  open,
  readdir,
  readFile,
  rm,
  rmdir,
} from 'node:fs/promises';
import { basename, dirname } from 'node:path';

type GuardRecord = Readonly<{
  pid: number;
  processStartTime: string;
  token: string;
}>;

const GUARD_TIMEOUT_MS = 60_000;
const guardPath = (path: string) => `${path}.reclaim-guard`;
const ownerPrefix = (path: string) => `${basename(path)}.reclaim-owner-`;
const ownerPath = (path: string, token: string) =>
  `${path}.reclaim-owner-${process.pid}-${token}`;

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

function currentProcessStartTime() {
  const value = processStartTime(process.pid);
  if (!value)
    throw new Error('evidence lock guard owner identity is unavailable');
  return value;
}

function parseRecord(value: string): GuardRecord {
  try {
    const parsed: unknown = JSON.parse(value);
    if (
      parsed &&
      typeof parsed === 'object' &&
      Number.isInteger((parsed as { pid?: unknown }).pid) &&
      typeof (parsed as { processStartTime?: unknown }).processStartTime ===
        'string' &&
      typeof (parsed as { token?: unknown }).token === 'string'
    )
      return parsed as GuardRecord;
  } catch {
    // Treat malformed owner metadata as an authority failure below.
  }
  throw new Error('evidence lock guard owner metadata is invalid');
}

function isProcessLive(record: GuardRecord) {
  if (record.pid <= 0) return false;
  try {
    process.kill(record.pid, 0);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EPERM') return false;
  }
  const observed = processStartTime(record.pid);
  return observed === undefined || observed === record.processStartTime;
}

async function writeOwnerRecord(path: string, record: GuardRecord) {
  const handle = await open(
    path,
    constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      constants.O_NOFOLLOW,
    0o600
  );
  try {
    await handle.writeFile(`${JSON.stringify(record)}\n`);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function readOwnerRecords(path: string) {
  const directory = dirname(path);
  const entries = await readdir(directory, { withFileTypes: true });
  const records: Array<{ path: string; record: GuardRecord }> = [];
  for (const entry of entries) {
    if (!entry.name.startsWith(ownerPrefix(path))) continue;
    const recordPath = `${directory}/${entry.name}`;
    const stat = await lstat(recordPath);
    if (stat.isSymbolicLink() || !stat.isFile() || (stat.mode & 0o077) !== 0)
      throw new Error('evidence lock guard owner metadata is not private');
    records.push({
      path: recordPath,
      record: parseRecord(await readFile(recordPath, 'utf8')),
    });
  }
  return records;
}

const waitForGuard = () =>
  new Promise<void>((resolve) => setTimeout(resolve, 5));

/** Serializes lock-path mutation and lock acquisition across processes. */
export async function withEvidenceLockPathGuard<T>(
  path: string,
  operation: () => Promise<T>
) {
  const token = randomUUID();
  const metadataPath = ownerPath(path, token);
  await writeOwnerRecord(metadataPath, {
    pid: process.pid,
    processStartTime: currentProcessStartTime(),
    token,
  });
  const deadline = Date.now() + GUARD_TIMEOUT_MS;
  let acquired = false;
  try {
    while (!acquired) {
      if (Date.now() >= deadline)
        throw new Error('evidence lock guard wait timed out');
      const records = await readOwnerRecords(path);
      const liveRecords = records.filter(({ record }) => isProcessLive(record));
      const firstLiveRecord = [...liveRecords].sort((left, right) =>
        left.path.localeCompare(right.path)
      )[0];
      if (firstLiveRecord?.path !== metadataPath) {
        await waitForGuard();
        continue;
      }
      for (const { path: recordPath, record } of records)
        if (recordPath !== metadataPath && !isProcessLive(record))
          await rm(recordPath, { force: true });
      try {
        await mkdir(guardPath(path), { mode: 0o700 });
        acquired = true;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
        const stat = await lstat(guardPath(path));
        if (stat.isSymbolicLink() || !stat.isDirectory())
          throw new Error('evidence lock guard is not a private directory');
        await waitForGuard();
      }
    }
    return await operation();
  } finally {
    if (acquired) await rmdir(guardPath(path));
    await rm(metadataPath, { force: true });
  }
}

/** Creates a lock record under the same guard used by stale-owner reclaim. */
export function tryCreateEvidenceLock(path: string, contents: string) {
  return withEvidenceLockPathGuard(path, async () => {
    try {
      const handle = await open(path, 'wx', 0o600);
      try {
        await handle.writeFile(contents);
        await handle.sync();
      } finally {
        await handle.close();
      }
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
      throw error;
    }
  });
}
