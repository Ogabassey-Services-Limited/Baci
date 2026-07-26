import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

const fail = () => {
  throw new TypeError('root runtime registration adapter refused');
};
const ownedDirectory = (details, owner) =>
  details?.isDirectory?.() &&
  !details.isSymbolicLink?.() &&
  details.uid === owner.uid &&
  details.gid === owner.gid &&
  (details.mode & 0o777) === 0o700;
const sameDirectory = (left, right, owner) =>
  ownedDirectory(left, owner) &&
  ownedDirectory(right, owner) &&
  left.dev === right.dev &&
  left.ino === right.ino;

export async function syncRegistrationAuthorityParent(
  path,
  dependencies = {},
  owner = { gid: 0, uid: 0 }
) {
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  if (
    typeof path !== 'string' ||
    typeof stat !== 'function' ||
    typeof openFile !== 'function' ||
    !Number.isInteger(owner?.uid) ||
    !Number.isInteger(owner?.gid)
  )
    fail();
  try {
    const before = await stat(path);
    if (!ownedDirectory(before, owner)) fail();
    const handle = await openFile(
      path,
      constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
    );
    try {
      const opened = await handle.stat();
      if (!sameDirectory(before, opened, owner)) fail();
      await handle.sync();
      if (!sameDirectory(opened, await handle.stat(), owner)) fail();
    } finally {
      await handle.close();
    }
  } catch {
    fail();
  }
}
