import assert from 'node:assert/strict';
import {
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  readFile,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  activatePrepareContentRoots,
  capturePrepareContentRoots,
  cleanupPrepareContentRoots,
} from './install-prepare-content-cleanup.mjs';

async function fixture() {
  const base = await mkdtemp(join(tmpdir(), 'cwv-content-'));
  const campaign = join(base, 'campaign');
  const docker = join(base, 'docker');
  const containerd = join(base, 'containerd');
  await mkdir(campaign, { mode: 0o700 });
  await mkdir(docker, { mode: 0o700 });
  await mkdir(containerd, { mode: 0o700 });
  return {
    base,
    campaign,
    roots: [
      { kind: 'docker', path: docker },
      { kind: 'containerd', path: containerd },
    ],
    owner: process.getuid(),
    group: process.getgid(),
    mountPoints: [],
  };
}

test('captures empty fixed roots before mutation and removes only activated content', async () => {
  const context = await fixture();
  const receipt = await capturePrepareContentRoots({
    ...context,
    transactionId: 'prepare-a',
  });
  await activatePrepareContentRoots({
    ...context,
    transactionId: 'prepare-a',
    receipt,
  });
  await mkdir(join(context.roots[0].path, 'overlay2'), { mode: 0o700 });
  await writeFile(join(context.roots[0].path, 'overlay2', 'owned'), 'x');
  await mkdir(join(context.roots[1].path, 'io.containerd.content.v1.content'), {
    mode: 0o700,
  });

  await cleanupPrepareContentRoots({
    ...context,
    transactionId: 'prepare-a',
    receipt,
    assertQuiescent: () => Promise.resolve(),
  });

  assert.deepEqual(
    await Promise.all(
      context.roots.map(async (root) => (await lstat(root.path)).isDirectory())
    ),
    [true, true]
  );
  assert.deepEqual(
    await Promise.all(context.roots.map((root) => readdir(root.path))),
    [[], []]
  );
  assert.equal(
    JSON.parse(
      await readFile(
        join(context.campaign, 'prepare-content-roots.json'),
        'utf8'
      )
    ).generation,
    receipt.generation
  );
});

test('repairs a partial activation after a crash with dead daemons', async () => {
  const context = await fixture();
  const receipt = await capturePrepareContentRoots({
    ...context,
    transactionId: 'prepare-b',
  });
  const probe = await open(join(context.base, 'probe'), 'w');
  const prototype = Object.getPrototypeOf(probe);
  const originalSync = prototype.sync;
  await probe.close();
  prototype.sync = () =>
    Promise.reject(new Error('simulated marker sync failure'));
  try {
    await assert.rejects(
      () =>
        activatePrepareContentRoots({
          ...context,
          transactionId: 'prepare-b',
          receipt,
        }),
      /simulated marker sync failure/
    );
  } finally {
    prototype.sync = originalSync;
  }
  assert.deepEqual(await readdir(context.roots[0].path), [
    `.baci-cwv-prepare-generation-${process.pid}`,
  ]);

  await cleanupPrepareContentRoots({
    ...context,
    transactionId: 'prepare-b',
    receipt,
    assertQuiescent: () => Promise.resolve(),
  });
});

test('restores an absent root when activation never created it', async () => {
  const context = await fixture();
  await rm(context.roots[1].path, { recursive: true });
  const receipt = await capturePrepareContentRoots({
    ...context,
    transactionId: 'prepare-absent',
  });

  await cleanupPrepareContentRoots({
    ...context,
    transactionId: 'prepare-absent',
    receipt,
    assertQuiescent: () => Promise.resolve(),
  });
});

test('refuses activation when a dedicated content root is mounted after capture', async () => {
  const context = await fixture();
  const receipt = await capturePrepareContentRoots({
    ...context,
    transactionId: 'prepare-mount-race',
  });

  await assert.rejects(
    () =>
      activatePrepareContentRoots({
        ...context,
        transactionId: 'prepare-mount-race',
        receipt,
        mountPoints: [context.roots[0].path],
      }),
    /mount/
  );
});

test('fails closed on replacement, symlink, mount, foreign content, or live references', async () => {
  for (const scenario of [
    'replacement',
    'symlink',
    'mount',
    'foreign',
    'live',
  ]) {
    const context = await fixture();
    const receipt = await capturePrepareContentRoots({
      ...context,
      transactionId: `prepare-${scenario}`,
    });
    await activatePrepareContentRoots({
      ...context,
      transactionId: `prepare-${scenario}`,
      receipt,
    });
    const docker = context.roots[0].path;
    let mountPoints = [];
    let assertQuiescent = () => Promise.resolve();
    if (scenario === 'replacement') {
      await rename(docker, `${docker}-old`);
      await mkdir(docker, { mode: 0o700 });
    } else if (scenario === 'symlink') {
      await rename(docker, `${docker}-old`);
      await symlink(`${docker}-old`, docker);
    } else if (scenario === 'mount') mountPoints = [docker];
    else if (scenario === 'foreign')
      await writeFile(join(docker, 'foreign'), 'x');
    else assertQuiescent = () => Promise.reject(new Error('live reference'));

    await assert.rejects(
      () =>
        cleanupPrepareContentRoots({
          ...context,
          transactionId: `prepare-${scenario}`,
          receipt,
          mountPoints,
          assertQuiescent,
        }),
      /(?:identity|symlink|mount|foreign|live reference)/
    );
  }
});
