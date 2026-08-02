import { randomUUID } from 'node:crypto';
import { link, lstat, open, readFile, rm } from 'node:fs/promises';
import { withEvidenceLockPathGuard } from './cloudflare-evidence-lock-guard';

type ReclamationHook = (path: string, ownerText: string) => Promise<void>;

const lockTombstonePath = (path: string) =>
  `${path}.reclaim-${process.pid}-${randomUUID()}`;

function isPrivateRegularFile(stat: Awaited<ReturnType<typeof lstat>>) {
  return (
    !stat.isSymbolicLink() && stat.isFile() && (Number(stat.mode) & 0o077) === 0
  );
}

function isSameInode(
  left: { dev: number; ino: number },
  right: { dev: number; ino: number }
) {
  return left.dev === right.dev && left.ino === right.ino;
}

/**
 * Reclaims a lock only after a no-replace hard-link claim and two pathname
 * revalidations still identify the owner observed before reclamation. `link(2)`
 * never detaches or replaces `path`, so a successor that appears before the
 * claim remains at the lock pathname. The guard around this function
 * serializes cooperating creators through the final unlink.
 */
async function reclaimLockIfOwnerUnsafe(
  path: string,
  expected: string | undefined,
  afterOwnerCheck?: ReclamationHook,
  beforeClaim?: ReclamationHook,
  beforeUnlink?: ReclamationHook
) {
  let ownerHandle: Awaited<ReturnType<typeof open>> | undefined;
  let tombstone: string | undefined;
  try {
    const lockStat = await lstat(path);
    if (!isPrivateRegularFile(lockStat))
      throw new Error('evidence lock is not private regular storage');
    ownerHandle = await open(path, 'r');
    const ownerInode = await ownerHandle.stat();
    const ownerText = await ownerHandle.readFile('utf8');
    if (expected !== undefined && ownerText !== expected) return false;
    await beforeClaim?.(path, ownerText);
    tombstone = lockTombstonePath(path);
    try {
      // link(2) never replaces or detaches `path`. If a successor replaced
      // the pathname after the owner check, the claim points at that
      // successor; the inode/content check below then discards only our
      // private tombstone and leaves the successor untouched.
      await link(path, tombstone);
    } catch (error) {
      // The destination may already exist only if the random claim name
      // collided. It is not ours, so never let the outer cleanup remove it.
      tombstone = undefined;
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
    if (!ownsTombstone) {
      await rm(tombstone, { force: true });
      tombstone = undefined;
      return false;
    }

    const pathStillOwner = async () => {
      let currentStat: Awaited<ReturnType<typeof lstat>>;
      try {
        currentStat = await lstat(path);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
      }
      if (
        !isPrivateRegularFile(currentStat) ||
        !isSameInode(ownerInode, currentStat)
      )
        return false;
      try {
        return (await readFile(path, 'utf8')) === ownerText;
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
        throw error;
      }
    };

    if (!(await pathStillOwner())) {
      await rm(tombstone, { force: true });
      tombstone = undefined;
      return false;
    }
    await beforeUnlink?.(path, ownerText);
    if (!(await pathStillOwner())) {
      await rm(tombstone, { force: true });
      tombstone = undefined;
      return false;
    }

    // All cooperating creators are excluded by withEvidenceLockPathGuard while
    // this unlink runs. The hard-link claim ensures a successor was never
    // detached into our tombstone in the first place.
    try {
      await rm(path, { force: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        await rm(tombstone, { force: true });
        tombstone = undefined;
        return true;
      }
      throw error;
    }
    await rm(tombstone, { force: true });
    tombstone = undefined;
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return true;
    if (tombstone) await rm(tombstone, { force: true }).catch(() => undefined);
    throw error;
  } finally {
    await ownerHandle?.close();
  }
}

export function reclaimLockIfOwner(
  path: string,
  expected: string | undefined,
  afterOwnerCheck?: ReclamationHook,
  beforeClaim?: ReclamationHook,
  beforeUnlink?: ReclamationHook
) {
  return withEvidenceLockPathGuard(path, () =>
    reclaimLockIfOwnerUnsafe(
      path,
      expected,
      afterOwnerCheck,
      beforeClaim,
      beforeUnlink
    )
  );
}
