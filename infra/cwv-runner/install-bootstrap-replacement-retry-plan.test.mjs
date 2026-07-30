import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import {
  appendBootstrapJournal,
  beginBootstrap,
  persistBootstrapCapture,
} from './install-bootstrap.mjs';
import { publishBootstrapPlan } from './install-bootstrap-plan-publication.mjs';
import { readBootstrapReplacementStateInventory } from './install-bootstrap-replacement-state-inventory.mjs';

test('accepts a same-generation retry plan after one managed replacement', async (context) => {
  const parent = await mkdtemp(join(tmpdir(), 'baci-plan-retry-'));
  const stateRoot = join(parent, 'bootstrap');
  const sourceSha = 'b'.repeat(40);
  const transactionId = `bootstrap-${sourceSha.slice(0, 12)}`;
  const path = '/srv/baci-cwv/sealed/bootstrap.sha256';
  const files = {
    [path]: { sha256: 'e'.repeat(64), mode: '0600', owner: 'root:root' },
  };
  const input = {
    transactionId,
    sourceSha,
    sourceManifestSha256: 'c'.repeat(64),
    policyFileSha256: 'd'.repeat(64),
    files,
    prior: { [path]: { absent: true } },
  };
  await mkdir(stateRoot, { mode: 0o700 });
  context.after(() => rm(parent, { recursive: true, force: true }));
  await persistBootstrapCapture(stateRoot, beginBootstrap(input));
  await appendBootstrapJournal(join(stateRoot, transactionId), {
    action: 'install-file',
    path,
    sha256: files[path].sha256,
  });
  await publishBootstrapPlan(
    parent,
    Buffer.from(`${JSON.stringify({ ...input, prior: files })}\n`)
  );

  assert.deepEqual(await readBootstrapReplacementStateInventory(stateRoot), [
    transactionId,
  ]);
  assert.deepEqual(await readdir(parent), ['bootstrap']);
});
