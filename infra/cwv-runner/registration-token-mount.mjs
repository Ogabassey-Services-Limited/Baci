import { lstat, readFile } from 'node:fs/promises';

const fail = () => {
  throw new TypeError('registration token mount refused');
};

function device(dev) {
  if (!Number.isSafeInteger(dev) || dev < 0) fail();
  return `${((dev >> 8) & 0xfff) | (Math.floor(dev / 2 ** 32) & 0xfffff000)}:${(dev & 0xff) | (Math.floor(dev / 2 ** 12) & 0xffffff00)}`;
}

function mountInfo(bytes, target, dev) {
  if (!Buffer.isBuffer(bytes)) fail();
  const row = bytes
    .toString('utf8')
    .split('\n')
    .map((value) => value.split(' - '))
    .filter(([before, after]) => before && after)
    .map(([before, after]) => [before.split(' '), after.split(' ')])
    .filter(([before]) => before[2] === device(dev) && before[4] === target);
  if (row.length !== 1) fail();
  const [before, after] = row[0];
  if (before.length < 6 || after.length !== 3) fail();
  const options = new Set([...before[5].split(','), ...after[2].split(',')]);
  if (
    before[3] !== '/' ||
    !before[5].split(',').includes('rw') ||
    after[0] !== 'tmpfs' ||
    after[1] !== 'tmpfs' ||
    !['nodev', 'noexec', 'nosuid'].every((option) => options.has(option))
  )
    fail();
}

export async function assertRegistrationTokenMount(
  target,
  expected,
  dependencies = {}
) {
  if (!expected?.isDirectory?.() || expected.isSymbolicLink?.()) fail();
  const stat = dependencies.lstat ?? lstat;
  const read = dependencies.readFile ?? readFile;
  const details = await stat(target);
  if (
    !details.isDirectory() ||
    details.isSymbolicLink() ||
    details.dev !== expected.dev ||
    details.ino !== expected.ino ||
    details.uid !== 0 ||
    details.gid !== 0 ||
    (details.mode & 0o777) !== 0o700
  )
    fail();
  mountInfo(await read('/proc/self/mountinfo'), target, details.dev);
  return Object.freeze({ dev: details.dev, ino: details.ino });
}
