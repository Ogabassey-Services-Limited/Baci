import { constants, type Stats } from 'node:fs';
import { type FileHandle, lstat, open } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import {
  assertAuthorityAncestorsUnchanged,
  captureAuthorityAncestors,
} from './cloudflare-evidence-authority-path';

function isPrivateRegularFile(stat: Stats) {
  return (
    !stat.isSymbolicLink() &&
    stat.isFile() &&
    (Number(stat.mode) & 0o777) === 0o600
  );
}

function hasSameIdentity(left: Stats, right: Stats) {
  return (
    Number(left.dev) === Number(right.dev) &&
    Number(left.ino) === Number(right.ino)
  );
}

/** Reads one authority artifact through a stable, no-follow file handle. */
export async function readAuthorityArtifact(path: string, label: string) {
  if (!isAbsolute(path))
    throw new Error(`${label} artifact path must be absolute`);
  const ancestors = await captureAuthorityAncestors(path, label);
  const scope = resolve(dirname(path));
  const scopeStat = await lstat(scope).catch(() => {
    throw new Error(`${label} authority scope is not readable`);
  });
  if (
    scopeStat.isSymbolicLink() ||
    !scopeStat.isDirectory() ||
    (Number(scopeStat.mode) & 0o077) !== 0
  )
    throw new Error(`${label} authority scope is not private durable storage`);

  let expectedStat: Stats;
  try {
    expectedStat = await lstat(path);
  } catch {
    throw new Error(`${label} artifact is not readable`);
  }
  if (!isPrivateRegularFile(expectedStat))
    throw new Error(`${label} artifact must be a private regular file`);

  let handle: FileHandle;
  try {
    handle = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ELOOP')
      throw new Error(`${label} artifact must be a private regular file`);
    throw new Error(`${label} artifact is not readable`);
  }
  try {
    let stat: Stats;
    try {
      stat = await handle.stat();
    } catch {
      throw new Error(`${label} artifact is not readable`);
    }
    if (!isPrivateRegularFile(stat) || !hasSameIdentity(expectedStat, stat))
      throw new Error(`${label} artifact must be a private regular file`);
    await assertAuthorityAncestorsUnchanged(path, label, ancestors);
    let source: string;
    try {
      source = await handle.readFile('utf8');
    } catch {
      throw new Error(`${label} artifact is not readable`);
    }
    try {
      return JSON.parse(source) as unknown;
    } catch {
      throw new Error(`${label} artifact is not valid JSON`);
    }
  } finally {
    await handle.close().catch(() => undefined);
  }
}
