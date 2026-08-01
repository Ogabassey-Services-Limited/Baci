import { randomUUID } from 'node:crypto';
import { link, lstat, open, readFile, rename, rm } from 'node:fs/promises';
import { withEvidenceLockPathGuard } from './cloudflare-evidence-lock-guard';

type ReclamationHook = (path: string, ownerText: string) => Promise<void>;

const lockTombstonePath = (path: string) =>
  `${path}.reclaim-${process.pid}-${randomUUID()}`;

function isPrivateRegularFile(stat: Awaited<ReturnType<typeof lstat>>) {
  return (
    !stat.isSymbolicLink() && stat.isFile() && (Number(stat.mode) & 0o077) === 0
  );
}

async function restoreLockTombstone(tombstone: string, path: string) {
  try {
    // link(2) never replaces `path`: if a newer owner acquired it while the
    // tombstone was detached, EEXIST leaves that newer pathname untouched.
    // It also preserves a successor symlink as a symlink; callers will reject
    // that path on their next private-regular-file validation.
    await link(tombstone, path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error;
  }
  await rm(tombstone, { force: true });
}

function isSameInode(
  left: { dev: number; ino: number },
  right: { dev: number; ino: number }
) {
  return left.dev === right.dev && left.ino === right.ino;
}

/**
 * Reclaims a lock only when the inode moved to the tombstone is still the owner
 * observed before reclamation. Hooks exist for deterministic race tests;
 * production callers omit them.
 */
async function reclaimLockIfOwnerUnsafe(
  path: string,
  expected: string | undefined,
  afterOwnerCheck?: ReclamationHook,
  beforeRename?: ReclamationHook
) {
  let ownerHandle: Awaited<ReturnType<typeof open>> | undefined;
  let ownerInode: { dev: number; ino: number } | undefined;
  let tombstone: string | undefined;
  try {
    const lockStat = await lstat(path);
    if (!isPrivateRegularFile(lockStat))
      throw new Error('evidence lock is not private regular storage');
    ownerHandle = await open(path, 'r');
    ownerInode = await ownerHandle.stat();
    const ownerText = await ownerHandle.readFile('utf8');
    if (expected !== undefined && ownerText !== expected) return false;
    await beforeRename?.(path, ownerText);
    tombstone = lockTombstonePath(path);
    try {
      // Rename is the ownership boundary. Whatever inode currently occupies
      // `path` is moved atomically to this unique tombstone; no later cleanup
      // operation targets a successor pathname.
      await rename(path, tombstone);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
    await afterOwnerCheck?.(path, ownerText);
    const tombstoneStat = await lstat(tombstone);
    if (!isPrivateRegularFile(tombstoneStat))
      throw new Error('evidence lock is not private regular storage');
    const ownsTombstone =
      isSameInode(ownerInode, tombstoneStat) &&
      (await readFile(tombstone, 'utf8')) === ownerText;
    if (ownsTombstone) {
      await rm(tombstone, { force: true });
      tombstone = undefined;
      return true;
    }
    await restoreLockTombstone(tombstone, path);
    tombstone = undefined;
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    if (tombstone && ownerInode) {
      try {
        await restoreLockTombstone(tombstone, path);
      } catch {
        // Preserve the original validation/read error. A tombstone left behind
        // is safer than replacing a successor pathname during recovery.
      }
    }
    throw error;
  } finally {
    await ownerHandle?.close();
  }
}

export function reclaimLockIfOwner(
  path: string,
  expected: string | undefined,
  afterOwnerCheck?: ReclamationHook,
  beforeRename?: ReclamationHook
) {
  return withEvidenceLockPathGuard(path, () =>
    reclaimLockIfOwnerUnsafe(path, expected, afterOwnerCheck, beforeRename)
  );
}
