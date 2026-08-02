import { createHash } from 'node:crypto';
import {
  closeSync,
  constants,
  fstatSync,
  fsyncSync,
  lstatSync,
  openSync,
  readSync,
  writeSync,
} from 'node:fs';
import { join } from 'node:path';
import { archiveLimits } from './archive-stream.mjs';

const fail = () => {
  throw new TypeError('runner archive snapshot refused');
};
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.size === right.size &&
  left.mode === right.mode &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.nlink === right.nlink &&
  left.mtimeMs === right.mtimeMs &&
  left.ctimeMs === right.ctimeMs;

export function snapshotRunnerArchive(archive, workspace) {
  const before = lstatSync(archive);
  if (
    !before.isFile() ||
    before.isSymbolicLink() ||
    before.uid !== process.getuid() ||
    before.nlink !== 1 ||
    before.size > archiveLimits.archiveBytes
  )
    fail();
  const source = openSync(archive, constants.O_RDONLY | constants.O_NOFOLLOW);
  const target = join(workspace, 'accepted-image.tar');
  let output;
  try {
    const opened = fstatSync(source);
    if (!same(before, opened)) fail();
    output = openSync(
      target,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o400
    );
    const hash = createHash('sha256');
    const buffer = Buffer.alloc(64 * 1024);
    for (let offset = 0; offset < opened.size; ) {
      const length = Math.min(buffer.length, opened.size - offset);
      const count = readSync(source, buffer, 0, length, offset);
      if (count !== length || writeSync(output, buffer, 0, count) !== count)
        fail();
      hash.update(buffer.subarray(0, count));
      offset += count;
    }
    fsyncSync(output);
    if (!same(opened, fstatSync(source))) fail();
    return Object.freeze({ path: target, sha256: hash.digest('hex') });
  } finally {
    if (output !== undefined) closeSync(output);
    closeSync(source);
  }
}
