import assert from 'node:assert/strict';
import { lstat, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  beginBootstrap,
  persistBootstrapCapture,
} from './install-bootstrap.mjs';
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
