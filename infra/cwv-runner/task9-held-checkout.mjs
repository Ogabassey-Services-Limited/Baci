import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  realpathSync,
} from 'node:fs';

export function withHeldTask9Checkout(path, expectedRoot, callback) {
  const fd = openSync(
    path,
    constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW
  );
  const initial = fstatSync(fd);
  const guard = () => {
    const current = fstatSync(fd);
    const visible = lstatSync(path, { throwIfNoEntry: false });
    if (
      !visible ||
      visible.isSymbolicLink() ||
      !visible.isDirectory() ||
      visible.dev !== initial.dev ||
      visible.ino !== initial.ino ||
      visible.uid !== initial.uid ||
      visible.gid !== initial.gid ||
      visible.mode !== initial.mode ||
      current.dev !== initial.dev ||
      current.ino !== initial.ino ||
      current.uid !== initial.uid ||
      current.gid !== initial.gid ||
      current.mode !== initial.mode ||
      realpathSync(path) !== expectedRoot
    )
      throw new TypeError('unsafe Task 9 checkout');
  };
  try {
    if (!initial.isDirectory() || initial.uid !== process.getuid())
      throw new TypeError('unsafe Task 9 checkout');
    guard();
    return callback({ fd, path, guard });
  } finally {
    closeSync(fd);
  }
}
