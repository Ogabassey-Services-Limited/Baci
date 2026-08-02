import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import { normalRunnerDynamicEnvironment } from './measurement-container-projection.mjs';

test('normal Docker startup projects exactly the four prestart values', () => {
  assert.deepEqual(normalRunnerDynamicEnvironment, [
    'BACI_CWV_CAMPAIGN_ID',
    'BACI_CWV_CAPTURE_SHA256',
    'BACI_CWV_LISTENER_RELEASE_NOT_BEFORE_MONOTONIC_SECONDS',
    'BACI_CWV_LISTENER_RELEASE_DEADLINE_MONOTONIC_SECONDS',
  ]);
});

test('controller publishes its normal release through the shared 13-key builder', async () => {
  const controller = await readFile(
    new URL('./exact-run-controller.sh', import.meta.url),
    'utf8'
  );
  const cli = await readFile(
    new URL('./exact-run-contract-cli.mjs', import.meta.url),
    'utf8'
  );
  assert.match(controller, /create-normal-release/);
  assert.match(cli, /createCanonicalNormalRelease/);
  assert.doesNotMatch(cli, /case 'validate-release'/);
});

test('all mounted admission consumers read active.json, never admission.json', async () => {
  const sources = await Promise.all(
    [
      'cwv-runner-authority-runtime.mjs',
      'job-start-hook.sh',
      'runner-identity-gate.mjs',
    ].map((name) => readFile(new URL(`./${name}`, import.meta.url), 'utf8'))
  );
  for (const source of sources) {
    assert.match(source, /baci-cwv-admission\/active\.json/);
    assert.doesNotMatch(source, /baci-cwv-admission\/admission\.json/);
  }
});
