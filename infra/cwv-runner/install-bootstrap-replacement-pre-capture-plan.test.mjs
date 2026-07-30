import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { publishBootstrapPlan } from './install-bootstrap-plan-publication.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

test('reconciles a production parent plan with its incomplete transaction before returning inventory', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-plan-incomplete-'));
  const stateRoot = join(parent, 'bootstrap');
  const sourceSha = 'b'.repeat(40);
  const transactionId = `bootstrap-${sourceSha.slice(0, 12)}`;
  const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const input = {
    transactionId,
    sourceSha,
    sourceManifestSha256: 'c'.repeat(64),
    policyFileSha256: 'd'.repeat(64),
    files: {
      [path]: {
        sha256: 'e'.repeat(64),
        mode: '0600',
        owner: 'root:root',
      },
    },
    prior: { [path]: { absent: true } },
  };
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));
  await mkdir(join(stateRoot, transactionId), { mode: 0o700 });
  await publishBootstrapPlan(parent, Buffer.from(`${JSON.stringify(input)}\n`));

  assert.deepEqual(await readBootstrapReplacementStateInventory(stateRoot), []);
  assert.deepEqual(await readdir(parent), ['bootstrap']);
  assert.deepEqual(await readdir(stateRoot), []);
});
