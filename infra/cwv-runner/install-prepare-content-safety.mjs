import * as fs from 'node:fs/promises';
import path from 'node:path';

const fail = (message) => {
  throw new Error(message);
};

class LiveReferenceBreachError extends Error {}

const EXPECTED_PROC_RACE_ERRORS = new Set(['ENOENT', 'ESRCH']);

export async function liveMountPoints(readMountInfo = fs.readFile) {
  const source = await readMountInfo('/proc/self/mountinfo', 'utf8');
  return source
    .split('\n')
    .filter(Boolean)
    .map((row) =>
      row
        .split(' ')[4]
        .replaceAll('\\040', ' ')
        .replaceAll('\\011', '\t')
        .replaceAll('\\012', '\n')
        .replaceAll('\\134', '\\')
    );
}

export function assertNoMount(root, points) {
  if (points.some((point) => point === root || point.startsWith(`${root}/`)))
    fail('content root mount drift');
}

export async function assertOwnedTree(
  root,
  current,
  row,
  points,
  owner,
  group
) {
  assertNoMount(current, points);
  const details = await fs.lstat(current);
  if (
    details.uid !== owner ||
    details.gid !== group ||
    details.dev !== row.parentDev
  )
    fail('foreign content identity');
  if (details.isSymbolicLink()) {
    const target = path.resolve(
      path.dirname(current),
      await fs.readlink(current)
    );
    if (!target.startsWith(`${root}/`)) fail('foreign content symlink');
    return;
  }
  if (details.isFile()) return;
  if (!details.isDirectory()) fail('foreign content type');
  for (const name of await fs.readdir(current))
    await assertOwnedTree(
      root,
      path.join(current, name),
      row,
      points,
      owner,
      group
    );
}

export async function removeOwnedTree(
  root,
  current,
  row,
  points,
  owner,
  group
) {
  await assertOwnedTree(root, current, row, points, owner, group);
  const details = await fs.lstat(current);
  if (details.isDirectory() && !details.isSymbolicLink()) {
    for (const name of await fs.readdir(current))
      await removeOwnedTree(
        root,
        path.join(current, name),
        row,
        points,
        owner,
        group
      );
    assertNoMount(current, points);
    await fs.rmdir(current);
  } else {
    assertNoMount(current, points);
    await fs.unlink(current);
  }
}

export async function assertNoLiveReferences(roots, operations = fs) {
  for (const socket of [
    '/run/baci-cwv/docker.sock',
    '/run/baci-cwv/containerd/containerd.sock',
  ]) {
    try {
      await operations.lstat(socket);
      fail('dedicated socket remains');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }
  for (const name of await operations.readdir('/proc')) {
    if (!/^\d+$/.test(name) || Number(name) === process.pid) continue;
    const directory = `/proc/${name}`;
    const assertNoLiveLink = async (link) => {
      try {
        const target = await operations.readlink(`${directory}/${link}`);
        if (
          roots.some(
            (root) => target === root.path || target.startsWith(`${root.path}/`)
          )
        )
          throw new LiveReferenceBreachError(
            'live reference to dedicated content'
          );
      } catch (error) {
        if (error instanceof LiveReferenceBreachError) throw error;
        if (!EXPECTED_PROC_RACE_ERRORS.has(error.code)) throw error;
      }
    };
    for (const link of ['cwd', 'root', 'exe']) await assertNoLiveLink(link);
    let fdLinks;
    try {
      fdLinks = (await operations.readdir(`${directory}/fd`)).map(
        (fd) => `fd/${fd}`
      );
    } catch (error) {
      if (!EXPECTED_PROC_RACE_ERRORS.has(error.code)) throw error;
      continue;
    }
    for (const link of fdLinks) await assertNoLiveLink(link);
  }
}
