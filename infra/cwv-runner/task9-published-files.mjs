import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readdirSync,
  readSync,
} from 'node:fs';
import { join } from 'node:path';

const ENTRIES = Object.freeze({
  'manifest.json': '100400',
  'manifest.sha256': '100400',
  'source.tar': '100400',
  'source.tar.sha256': '100400',
  'task9-bootstrap.mjs': '100400',
  node: '100500',
  'node-provenance.json': '100400',
});
const same = (left, right) =>
  left.dev === right.dev &&
  left.ino === right.ino &&
  left.uid === right.uid &&
  left.gid === right.gid &&
  left.mode === right.mode &&
  left.size === right.size;
const fail = () => {
  throw new TypeError('published Task 9 payload changed');
};

export function readPublishedTask9Files(
  directory,
  owner,
  { afterRead = () => undefined } = {}
) {
  const listed = readdirSync(directory).sort();
  const names = Object.keys(ENTRIES).sort();
  if (
    listed.length !== names.length ||
    listed.some((name, index) => name !== names[index])
  )
    fail();
  const handles = [];
  try {
    const files = Object.fromEntries(
      Object.entries(ENTRIES).map(([name, mode]) => {
        const path = join(directory, name);
        const fd = openSync(path, constants.O_RDONLY | constants.O_NOFOLLOW);
        const identity = fstatSync(fd);
        if (
          !identity.isFile() ||
          identity.uid !== owner ||
          identity.mode.toString(8) !== mode
        )
          fail();
        const bytes = Buffer.alloc(identity.size);
        for (let offset = 0; offset < bytes.length; ) {
          const count = readSync(
            fd,
            bytes,
            offset,
            bytes.length - offset,
            offset
          );
          if (count < 1) fail();
          offset += count;
        }
        handles.push({ bytes, fd, identity, path });
        return [
          name,
          { bytes: Buffer.from(bytes), mode, owner, symlink: false },
        ];
      })
    );
    afterRead();
    const verify = () => {
      for (const handle of handles) {
        const current = fstatSync(handle.fd);
        const path = lstatSync(handle.path, { throwIfNoEntry: false });
        if (
          !path ||
          path.isSymbolicLink() ||
          !same(handle.identity, current) ||
          !same(handle.identity, path)
        )
          fail();
        const bytes = Buffer.alloc(handle.identity.size);
        for (let offset = 0; offset < bytes.length; ) {
          const count = readSync(
            handle.fd,
            bytes,
            offset,
            bytes.length - offset,
            offset
          );
          if (count < 1) fail();
          offset += count;
        }
        if (!bytes.equals(handle.bytes)) fail();
      }
    };
    return {
      files,
      verify,
      close: () => {
        for (const handle of handles) closeSync(handle.fd);
      },
    };
  } catch (error) {
    for (const handle of handles) closeSync(handle.fd);
    throw error;
  }
}
