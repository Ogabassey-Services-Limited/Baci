import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildReceipt as actualBuildReceipt } from './install-prepare-acceptance.fixture.mjs';
import {
  acceptPreparedTarget,
  armPrepareWatchdog,
  buildOwnedPrepareReceipt,
  capturePrepare,
  proveSyntheticContainment,
  verifyPreparedCopies,
} from './install-prepare-controller.mjs';

const SHA = 'a'.repeat(64);
const IMAGE = `sha256:${'b'.repeat(64)}`;
const input = {
  transactionId: 'prepare-a',
  external: {
    archive: { path: '/owner/image.tar', device: '1', inode: '2' },
    receipt: { path: '/owner/build.json', device: '1', inode: '3' },
  },
  expected: { archiveSha256: SHA, receiptSha256: 'c'.repeat(64) },
  sourceManifestSha256: 'd'.repeat(64),
  policyFileSha256: 'e'.repeat(64),
};
const buildReceipt = structuredClone(actualBuildReceipt);

test('persists the closed capture-to-target-accepted prepare state machine', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-control-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);

  assert.equal((await capturePrepare(directory, input)).phase, 'captured');
  assert.equal(
    (await armPrepareWatchdog(directory, '4'.repeat(64))).phase,
    'watchdog-armed'
  );
  assert.equal(
    (
      await verifyPreparedCopies(directory, {
        archiveSha256: SHA,
        receiptSha256: 'c'.repeat(64),
        buildReceipt,
      })
    ).phase,
    'copies-verified'
  );
  assert.equal(
    (
      await proveSyntheticContainment(directory, {
        networkMode: 'none',
        cleaned: true,
        productionUnchanged: true,
        dedicatedSocket: '/run/baci-cwv/docker.sock',
      })
    ).phase,
    'synthetic-proven'
  );
  assert.equal(
    (
      await acceptPreparedTarget(directory, {
        imageId: IMAGE,
        imageConfigDigest: IMAGE,
        productionUnchanged: true,
        supervisorReceiptSha256: '5'.repeat(64),
      })
    ).phase,
    'target-accepted'
  );
});

test('binds cleanup to the exact receipt-owned prepare tree', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-prepare-owned-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const target = join(root, 'prepare-a');
  await mkdir(target, { mode: 0o700 });
  await writeFile(join(target, 'archive'), 'bytes', { mode: 0o600 });

  const receipt = await buildOwnedPrepareReceipt(root, 'prepare-a', 'tree');
  assert.deepEqual(
    Object.keys(receipt).sort(),
    [
      'contentSha256',
      'dev',
      'ino',
      'mode',
      'relative',
      'root',
      'rootDev',
      'rootIno',
      'schemaVersion',
      'type',
      'uid',
    ].sort()
  );
  assert.equal(receipt.root, root);
  assert.equal(receipt.relative, 'prepare-a');
  assert.equal(receipt.dev, (await lstat(target)).dev);
});

test('distinguishes file trees whose names collide under delimiter serialization', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-prepare-tree-hash-'));
  context.after(async () =>
    import('node:fs/promises').then(async ({ chmod, rm }) => {
      await chmod(root, 0o700);
      await rm(root, { recursive: true, force: true });
    })
  );
  await chmod(root, 0o700);
  const first = join(root, 'prepare-a');
  const second = join(root, 'prepare-b');
  const bytes = 'same bytes';
  const digest = createHash('sha256').update(bytes).digest('hex');
  await Promise.all([
    mkdir(first, { mode: 0o700 }),
    mkdir(second, { mode: 0o700 }),
  ]);
  await writeFile(join(first, `a:384:${digest}\nb`), bytes, { mode: 0o600 });
  await Promise.all([
    writeFile(join(second, 'a'), bytes, { mode: 0o600 }),
    writeFile(join(second, 'b'), bytes, { mode: 0o600 }),
  ]);

  const [one, two] = await Promise.all([
    buildOwnedPrepareReceipt(root, 'prepare-a', 'tree'),
    buildOwnedPrepareReceipt(root, 'prepare-b', 'tree'),
  ]);

  assert.notEqual(one.contentSha256, two.contentSha256);
});

test('refuses a prepare tree replaced after its identity is observed', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-prepare-snapshot-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const target = join(root, 'prepare-a');
  const displaced = join(root, 'displaced');
  await mkdir(target, { mode: 0o700 });
  await writeFile(join(target, 'archive'), 'trusted', { mode: 0o600 });
  let replaced = false;

  await assert.rejects(
    () =>
      buildOwnedPrepareReceipt(root, 'prepare-a', 'tree', false, {
        lstat: async (path, options) => {
          const details = await lstat(path, options);
          if (path === target && !replaced) {
            replaced = true;
            await rename(target, displaced);
            await mkdir(target, { mode: 0o700 });
            await writeFile(join(target, 'archive'), 'replacement', {
              mode: 0o600,
            });
          }
          return details;
        },
        open,
        readdir,
      }),
    /changed|unsafe/
  );
});

test('refuses a prepare file mutated in place after its content is read', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-prepare-snapshot-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const target = join(root, 'prepare-a');
  await writeFile(target, 'trusted', { mode: 0o600 });

  await assert.rejects(
    () =>
      buildOwnedPrepareReceipt(root, 'prepare-a', 'file', false, {
        lstat,
        open: async (...args) => {
          const handle = await open(...args);
          return {
            close: () => handle.close(),
            readFile: async () => {
              const bytes = await handle.readFile();
              await writeFile(target, 'mutated');
              return bytes;
            },
            stat: (options) => handle.stat(options),
          };
        },
        readdir,
      }),
    /changed/
  );
});

test('bugfix: refuses same-length in-place bytes that retain the observed metadata', async (context) => {
  const root = await mkdtemp(join(tmpdir(), 'baci-prepare-byte-race-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(root, { recursive: true, force: true })
    )
  );
  await chmod(root, 0o700);
  const target = join(root, 'prepare-a');
  await writeFile(target, 'trusted', { mode: 0o600 });
  const stable = await lstat(target, { bigint: true });
  let reads = 0;

  await assert.rejects(
    () =>
      buildOwnedPrepareReceipt(root, 'prepare-a', 'file', false, {
        lstat: async (path, options) =>
          path === target ? stable : await lstat(path, options),
        open: async (...args) => {
          const handle = await open(...args);
          return {
            close: () => handle.close(),
            readFile: async () => {
              const bytes = await handle.readFile();
              if (++reads === 1) await writeFile(target, 'mutated');
              return bytes;
            },
            stat: async () => stable,
          };
        },
        readdir,
      }),
    /changed/
  );
});

test('does not accept a target before copied and synthetic proofs', async (context) => {
  const directory = await mkdtemp(join(tmpdir(), 'baci-prepare-refuse-'));
  context.after(async () =>
    import('node:fs/promises').then(({ rm }) =>
      rm(directory, { recursive: true, force: true })
    )
  );
  await chmod(directory, 0o700);
  await capturePrepare(directory, input);

  await assert.rejects(
    () =>
      acceptPreparedTarget(directory, {
        imageId: IMAGE,
        imageConfigDigest: IMAGE,
        productionUnchanged: true,
        supervisorReceiptSha256: '5'.repeat(64),
      }),
    /synthetic/
  );
});
