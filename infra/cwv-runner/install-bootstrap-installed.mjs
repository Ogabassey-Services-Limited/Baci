import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const owner = (details) =>
  details.uid === 0 && details.gid === 0
    ? 'root:root'
    : details.uid === 0 && details.gid === 10001
      ? 'root:baci-cwv'
      : null;
const safeInstalledFile = (details) =>
  details?.isFile?.() && !details.isSymbolicLink?.() && owner(details) !== null;
const sameSnapshot = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mode === right.mode &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs;
const refuse = (path) => {
  throw new TypeError(`unsafe installed bootstrap path: ${path}`);
};

export async function readPinnedBootstrapFile(
  path,
  { lstatFile = lstat, openFile = open } = {}
) {
  const before = await lstatFile(path);
  if (!before.isFile() || before.isSymbolicLink())
    throw new TypeError(`unsafe bootstrap source path: ${path}`);
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (!sameSnapshot(before, opened))
      throw new TypeError(`unsafe bootstrap source path: ${path}`);
    const bytes = await handle.readFile();
    if (
      bytes.length !== opened.size ||
      !sameSnapshot(opened, await handle.stat())
    )
      throw new TypeError(`unsafe bootstrap source path: ${path}`);
    return { bytes, details: opened };
  } finally {
    await handle.close();
  }
}

export async function readInstalledProjection(
  files,
  { lstatFile = lstat, openFile = open } = {}
) {
  if (!files || typeof files !== 'object' || Array.isArray(files))
    throw new TypeError('bootstrap file projection required');
  const projection = {};
  for (const path of Object.keys(files).sort()) {
    let before;
    try {
      before = await lstatFile(path);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
      projection[path] = { absent: true };
      continue;
    }
    if (!safeInstalledFile(before)) refuse(path);
    const handle = await openFile(
      path,
      constants.O_RDONLY | constants.O_NOFOLLOW
    );
    try {
      const opened = await handle.stat();
      if (!safeInstalledFile(opened) || !sameSnapshot(before, opened))
        refuse(path);
      const bytes = Buffer.allocUnsafe(before.size);
      if (
        (await handle.read(bytes, 0, before.size, 0)).bytesRead !== before.size
      )
        refuse(path);
      if (
        (await handle.read(Buffer.alloc(1), 0, 1, before.size)).bytesRead !== 0
      )
        refuse(path);
      const after = await handle.stat();
      if (!safeInstalledFile(after) || !sameSnapshot(opened, after))
        refuse(path);
      projection[path] = {
        sha256: sha256(bytes),
        mode: (opened.mode & 0o777).toString(8).padStart(4, '0'),
        owner: owner(opened),
      };
    } finally {
      await handle.close();
    }
  }
  return projection;
}
