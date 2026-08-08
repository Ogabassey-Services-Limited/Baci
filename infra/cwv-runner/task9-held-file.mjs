import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';

const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.mode === right.mode &&
  left.size === right.size;
const fail = () => {
  throw new TypeError('unsafe Task 9 input');
};

export function readHeldTask9File(
  path,
  expectedMode,
  { afterRead = () => undefined } = {}
) {
  const absolute = resolve(path);
  let fd;
  try {
    fd = openSync(absolute, constants.O_RDONLY | constants.O_NOFOLLOW);
    const before = fstatSync(fd);
    if (
      !before.isFile() ||
      before.uid !== process.getuid() ||
      (before.mode & 0o777) !== expectedMode ||
      !Number.isSafeInteger(before.size) ||
      before.size < 0
    )
      fail();
    const bytes = readFileSync(fd);
    afterRead();
    const after = fstatSync(fd);
    const current = lstatSync(absolute);
    if (
      !Buffer.isBuffer(bytes) ||
      bytes.length !== before.size ||
      current.isSymbolicLink() ||
      !current.isFile() ||
      !same(before, after) ||
      !same(after, current)
    )
      fail();
    return { bytes: Buffer.from(bytes), path: absolute };
  } catch {
    fail();
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}
