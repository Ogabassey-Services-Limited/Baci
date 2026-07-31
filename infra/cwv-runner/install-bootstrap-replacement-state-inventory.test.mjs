import assert from 'node:assert/strict';
import {
  link,
  lstat,
  mkdir,
  mkdtemp,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  beginBootstrap,
  persistBootstrapCapture,
} from './install-bootstrap.mjs';
import { publishBootstrapPlan } from './install-bootstrap-plan-publication.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

const sourceSha = 'b'.repeat(40);
const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
const input = {
  transactionId: 'bootstrap-bbbbbbbbbbbb',
  sourceSha,
  sourceManifestSha256: 'c'.repeat(64),
  policyFileSha256: 'd'.repeat(64),
  files: {
    [path]: { sha256: 'e'.repeat(64), mode: '0600', owner: 'root:root' },
  },
  prior: { [path]: { absent: true } },
};
const state = beginBootstrap(input);
const details = {
  gid: process.getgid(),
  mode: 0o100600,
  nlink: 1,
  uid: process.getuid(),
};

test('reconciles the exact hard-linked plan pair left by a crash before staging unlink', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-legacy-plan-'));
  const stateRoot = join(parent, 'bootstrap');
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));

  await assert.rejects(
    publishBootstrapPlan(parent, Buffer.from(`${JSON.stringify(input)}\n`), {
      removeFile: () => {
        throw new Error('simulated crash before staging unlink');
      },
    }),
    /simulated crash/
  );
  const interrupted = await readdir(parent);
  assert.equal(
    interrupted.some((name) => name.startsWith('.plan.')),
    true
  );
  assert.equal(
    interrupted.some((name) => name.startsWith('.bootstrap-plan-stage.')),
    true
  );

  assert.deepEqual(await readBootstrapReplacementStateInventory(stateRoot), []);
  assert.deepEqual(await readdir(parent), ['bootstrap']);
});

test('refuses matching plan and staging bytes unless they are the same hard-linked inode', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-legacy-plan-'));
  const stateRoot = join(parent, 'bootstrap');
  const token = 'a'.repeat(32);
  const plan = join(parent, `.plan.${token}`);
  const stage = join(parent, `.bootstrap-plan-stage.${token}`);
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));
  await writeFile(plan, `${JSON.stringify(input)}\n`, { mode: 0o600 });
  await link(plan, join(parent, '.unrelated-plan-link'));
  await writeFile(stage, `${JSON.stringify(input)}\n`, { mode: 0o600 });
  await link(stage, join(parent, '.unrelated-stage-link'));

  await assert.rejects(
    readBootstrapReplacementStateInventory(stateRoot),
    /invalid legacy bootstrap plan/
  );
  assert.equal((await lstat(plan)).nlink, 2);
  assert.equal((await lstat(stage)).nlink, 2);
});

test('removes a parent legacy plan only when its exact bytes bind to a captured transaction', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-legacy-plan-'));
  const stateRoot = join(parent, 'bootstrap');
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));
  await persistBootstrapCapture(stateRoot, state);
  const legacy = join(parent, '.plan.A1b2C3');
  await writeFile(legacy, `${JSON.stringify(input)}\n`, { mode: 0o600 });

  assert.deepEqual(await readBootstrapReplacementStateInventory(stateRoot), [
    input.transactionId,
  ]);
  await assert.rejects(lstat(legacy), { code: 'ENOENT' });
});

test('discards a canonical parent plan orphaned before capture when a later generation exists', async () => {
  const removed = [];
  const synced = [];

  assert.deepEqual(
    await readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => ['bootstrap-aaaaaaaaaaaa'],
      listPlanDirectories: async () => ['.plan.A1b2C3'],
      readPinnedFile: async () => ({
        bytes: Buffer.from(`${JSON.stringify(input)}\n`),
        details,
      }),
      readState: () => {
        throw new Error('an orphan plan has no state to read');
      },
      removeFile: async (file) => removed.push(file),
      syncDirectory: async (directory) => synced.push(directory),
    }),
    ['bootstrap-aaaaaaaaaaaa']
  );
  assert.deepEqual(removed, ['/.plan.A1b2C3']);
  assert.deepEqual(synced, ['/']);
});

test('refuses an orphan plan whose transaction is not derived from its source', async () => {
  const mismatched = { ...input, transactionId: 'bootstrap-aaaaaaaaaaaa' };
  let removed = false;

  await assert.rejects(
    readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => ['bootstrap-cccccccccccc'],
      listPlanDirectories: async () => ['.plan.A1b2C3'],
      readPinnedFile: async () => ({
        bytes: Buffer.from(`${JSON.stringify(mismatched)}\n`),
        details,
      }),
      removeFile: () => {
        removed = true;
      },
    }),
    /invalid legacy bootstrap plan/
  );
  assert.equal(removed, false);
});

test('refuses a plan whose inventoried transaction state is missing', async () => {
  let removed = false;

  await assert.rejects(
    readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => [input.transactionId],
      listPlanDirectories: async () => ['.plan.A1b2C3'],
      readPinnedFile: async () => ({
        bytes: Buffer.from(`${JSON.stringify(input)}\n`),
        details,
      }),
      readState: () => {
        const error = new Error('missing transaction');
        error.code = 'ENOENT';
        throw error;
      },
      removeFile: () => {
        removed = true;
      },
    }),
    { code: 'ENOENT' }
  );
  assert.equal(removed, false);
});

test('removes an original in-root legacy plan only when its exact bytes bind to a captured transaction', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-legacy-plan-'));
  const stateRoot = join(parent, 'bootstrap');
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));
  await persistBootstrapCapture(stateRoot, state);
  const legacy = join(stateRoot, '.plan.A1b2C3');
  await writeFile(legacy, `${JSON.stringify(input)}\n`, { mode: 0o600 });

  assert.deepEqual(await readBootstrapReplacementStateInventory(stateRoot), [
    input.transactionId,
  ]);
  await assert.rejects(lstat(legacy), { code: 'ENOENT' });
});

test('refuses parent legacy bytes that do not match their captured transaction', async () => {
  const drifted = { ...input, sourceManifestSha256: 'f'.repeat(64) };
  let removed = false;

  await assert.rejects(
    readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => [input.transactionId],
      listPlanDirectories: (directory) => {
        assert.equal(directory, '/');
        return ['.plan.A1b2C3'];
      },
      readPinnedFile: (file) => {
        assert.equal(file, '/.plan.A1b2C3');
        return {
          bytes: Buffer.from(`${JSON.stringify(drifted)}\n`),
          details,
        };
      },
      readState: async () => state,
      removeFile: () => {
        removed = true;
      },
    }),
    /invalid legacy bootstrap plan/
  );
  assert.equal(removed, false);
});

test('does not remove either historical plan when one exact plan has digest drift', async () => {
  const drifted = { ...input, sourceManifestSha256: 'f'.repeat(64) };
  const removed = [];

  await assert.rejects(
    readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => [input.transactionId, '.plan.A1b2C3'],
      listPlanDirectories: async () => ['.plan.D4e5F6'],
      readPinnedFile: async (file) => ({
        bytes: Buffer.from(
          `${JSON.stringify(file.startsWith('/state/') ? input : drifted)}\n`
        ),
        details,
      }),
      readState: async () => state,
      removeFile: async (file) => removed.push(file),
    }),
    /invalid legacy bootstrap plan/
  );
  assert.deepEqual(removed, []);
});

test('refuses an exact legacy-plan symlink without deleting it', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-legacy-plan-'));
  const stateRoot = join(parent, 'bootstrap');
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));
  await persistBootstrapCapture(stateRoot, state);
  const target = join(parent, 'target');
  const legacy = join(stateRoot, '.plan.A1b2C3');
  await writeFile(target, `${JSON.stringify(input)}\n`, { mode: 0o600 });
  await symlink(target, legacy);

  await assert.rejects(
    readBootstrapReplacementStateInventory(stateRoot),
    /unsafe bootstrap source path/
  );
  assert.equal((await lstat(legacy)).isSymbolicLink(), true);
});

test('refuses a noncanonical parent plan-like name without reading or deleting it', async () => {
  let read = false;
  let removed = false;

  await assert.rejects(
    readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => [input.transactionId],
      listPlanDirectories: async () => ['.plan.A1b2C3.extra'],
      readPinnedFile: () => {
        read = true;
      },
      removeFile: () => {
        removed = true;
      },
    }),
    /invalid legacy bootstrap plan/
  );
  assert.equal(read, false);
  assert.equal(removed, false);
});

test('retains the closed transaction inventory for arbitrary in-root plan-like names', async () => {
  await assert.rejects(
    readBootstrapReplacementStateInventory('/state', {
      listStateDirectories: async () => [
        input.transactionId,
        '.plan.A1b2C3.extra',
      ],
      listPlanDirectories: async () => [],
    }),
    /invalid bootstrap replacement state inventory/
  );
});
