import { lstatSync, mkdirSync } from 'node:fs';

const exactDirectory = (left, right) =>
  right &&
  !right.isSymbolicLink() &&
  right.isDirectory() &&
  right.dev === left.dev &&
  right.ino === left.ino &&
  right.uid === left.uid &&
  right.gid === left.gid &&
  right.mode === left.mode &&
  (right.mode & 0o777) === 0o700;

export function withTask9OutputDirectory(
  outputRoot,
  publish,
  { makeDirectory = mkdirSync } = {}
) {
  makeDirectory(outputRoot, { mode: 0o700 });
  const created = lstatSync(outputRoot);
  if (
    created.isSymbolicLink() ||
    !created.isDirectory() ||
    created.uid !== process.getuid() ||
    (created.mode & 0o777) !== 0o700
  )
    throw new TypeError('unsafe Task 9 output directory');
  const result = publish();
  if (
    !exactDirectory(created, lstatSync(outputRoot, { throwIfNoEntry: false }))
  )
    throw new TypeError('Task 9 output directory changed');
  return result;
}
