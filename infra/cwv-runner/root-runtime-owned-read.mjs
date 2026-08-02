import { constants } from 'node:fs';
import { lstat, open } from 'node:fs/promises';

const fail = () => {
  throw new TypeError('root runtime registration adapter refused');
};
const valid = (value, maximum) =>
  value?.isFile?.() &&
  !value.isSymbolicLink?.() &&
  value.uid === 0 &&
  value.gid === 0 &&
  value.nlink === 1 &&
  (value.mode & 0o777) === 0o400 &&
  value.size > 1 &&
  value.size <= maximum;

export async function readRootRuntimeOwnedFile(
  path,
  maximum,
  dependencies = {}
) {
  const stat = dependencies.lstat ?? lstat;
  const openFile = dependencies.open ?? open;
  const before = await stat(path);
  if (!valid(before, maximum)) fail();
  const handle = await openFile(
    path,
    constants.O_RDONLY | constants.O_NOFOLLOW
  );
  try {
    const opened = await handle.stat();
    if (
      !valid(opened, maximum) ||
      before.dev !== opened.dev ||
      before.ino !== opened.ino
    )
      fail();
    const bytes = Buffer.allocUnsafe(before.size);
    if ((await handle.read(bytes, 0, before.size, 0)).bytesRead !== before.size)
      fail();
    if ((await handle.read(Buffer.alloc(1), 0, 1, before.size)).bytesRead !== 0)
      fail();
    const after = await handle.stat();
    if (
      opened.dev !== after.dev ||
      opened.ino !== after.ino ||
      opened.size !== after.size
    )
      fail();
    return bytes;
  } finally {
    await handle.close();
  }
}
