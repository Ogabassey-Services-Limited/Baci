import { linkSync } from 'node:fs';

function acquireReclaimClaim({
  claimPath,
  lockPath,
  ownerPath,
  nowMs,
  isAlive,
  startedAt,
  stat,
  unlink,
  completeOwner,
  readLockOwner,
  sameLockOwner,
  removeOwnerPath,
  isStaleLock,
}) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      linkSync(ownerPath, claimPath);
      return true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
    }
    const claimOwner = readLockOwner(claimPath);
    if (
      !completeOwner(claimOwner) ||
      !isStaleLock({
        lockPath: claimPath,
        owner: claimOwner,
        nowMs,
        isAlive,
        startedAt,
        stat,
      }) ||
      !sameLockOwner(claimOwner, readLockOwner(claimPath))
    ) {
      return false;
    }
    try {
      unlink(claimPath);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
    removeOwnerPath(`${lockPath}.owner-${claimOwner.token}`, unlink);
  }
  return false;
}

export function reclaimStaleLock({
  lockPath,
  owner,
  ownerPath,
  nowMs,
  isAlive,
  startedAt,
  stat,
  unlink,
  completeOwner,
  readLockOwner,
  sameLockOwner,
  removeOwnerPath,
  isStaleLock,
}) {
  const claimPath = `${lockPath}.reclaim-${
    completeOwner(owner) ? owner.token : 'ownerless'
  }`;
  if (
    !acquireReclaimClaim({
      claimPath,
      lockPath,
      ownerPath,
      nowMs,
      isAlive,
      startedAt,
      stat,
      unlink,
      completeOwner,
      readLockOwner,
      sameLockOwner,
      removeOwnerPath,
      isStaleLock,
    })
  ) {
    return false;
  }
  let reclaimed = false;
  let reclaimError;
  try {
    if (sameLockOwner(owner, readLockOwner(lockPath))) {
      try {
        unlink(lockPath);
      } catch (error) {
        if (error?.code !== 'ENOENT') throw error;
      }
      if (completeOwner(owner)) {
        try {
          unlink(`${lockPath}.owner-${owner.token}`);
        } catch (error) {
          if (error?.code !== 'ENOENT') throw error;
        }
      }
      reclaimed = true;
    }
  } catch (error) {
    reclaimError = error;
  }
  try {
    unlink(claimPath);
  } catch (error) {
    if (error?.code !== 'ENOENT') reclaimError ||= error;
  }
  if (reclaimError) throw reclaimError;
  return reclaimed;
}
