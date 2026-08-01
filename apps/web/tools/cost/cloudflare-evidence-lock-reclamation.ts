import { randomUUID } from 'node:crypto';
import { link, lstat, open, rename, rm } from 'node:fs/promises';

type ReclamationHook = (path: string, ownerText: string) => Promise<void>;

const lockTombstonePath = (path: string) =>
  `${path}.reclaim-${process.pid}-${randomUUID()}`;

async function restoreLockTombstone(
  tombstone: string,
  path: string,
  ownerInode: { dev: number; ino: number }
) {
  try {
    // Hard-link before removing the tombstone to restore the exact inode
    // without replacing a successor that may have acquired the pathname.
    await link(tombstone, path);
    await rm(tombstone);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      // A successor owns `path`; only remove the tombstone when its inode is
      // the stale owner we just detached. Never delete a replacement inode.
      const tombstoneStat = await lstat(tombstone);
      if (isSameInode(ownerInode, tombstoneStat))
        await rm(tombstone, { force: true });
      return;
    }
    throw error;
  }
}

function isSameInode(
  left: { dev: number; ino: number },
  right: { dev: number; ino: number }
) {
  return left.dev === right.dev && left.ino === right.ino;
}

/**
 * Reclaims a lock only when the atomically renamed inode is still the owner
 * observed before reclamation. The hook exists for deterministic race tests;
 * production callers omit it.
 */
export async function reclaimLockIfOwner(
  path: string,
  expected: string | undefined,
  afterOwnerCheck?: ReclamationHook
) {
  let ownerHandle: Awaited<ReturnType<typeof open>> | undefined;
  let ownerInode: { dev: number; ino: number } | undefined;
  let tombstone: string | undefined;
  try {
    const lockStat = await lstat(path);
    if (
      lockStat.isSymbolicLink() ||
      !lockStat.isFile() ||
      (lockStat.mode & 0o077) !== 0
    )
      throw new Error('evidence lock is not private regular storage');
    ownerHandle = await open(path, 'r');
    ownerInode = await ownerHandle.stat();
    const ownerText = await ownerHandle.readFile('utf8');
    if (expected !== undefined && ownerText !== expected) return false;
    tombstone = lockTombstonePath(path);
    try {
      // Rename is the ownership boundary: all subsequent reads/deletes target
      // this unique tombstone, so a successor at `path` cannot be removed.
      await rename(path, tombstone);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
      throw error;
    }
    await afterOwnerCheck?.(path, ownerText);
    const tombstoneStat = await lstat(tombstone);
    if (
      tombstoneStat.isSymbolicLink() ||
      !tombstoneStat.isFile() ||
      (tombstoneStat.mode & 0o077) !== 0
    )
      throw new Error('evidence lock is not private regular storage');
    if (!isSameInode(ownerInode, tombstoneStat)) {
      await restoreLockTombstone(tombstone, path, ownerInode);
      tombstone = undefined;
      return false;
    }
    await rm(tombstone);
    tombstone = undefined;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    if (tombstone && ownerInode) {
      try {
        await restoreLockTombstone(tombstone, path, ownerInode);
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
