import { lstatSync, mkdirSync, readdirSync } from 'node:fs';

const OUTPUT_ENTRIES = Object.freeze([
  'bootstrap-review-envelope.json',
  'bootstrap-review-envelope.sha256',
  'payload',
]);

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
  const entries = readdirSync(outputRoot).sort();
  if (
    entries.length !== OUTPUT_ENTRIES.length ||
    entries.some((entry, index) => entry !== OUTPUT_ENTRIES[index])
  )
    throw new TypeError('Task 9 output entry set changed');
  return result;
}
