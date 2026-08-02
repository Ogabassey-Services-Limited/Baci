import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { createRegistrationSystemOperations } from './registration-root-system.mjs';

test('defers the real campaign lease release until the terminal lock operation', async () => {
  const calls = [];
  const system = createRegistrationSystemOperations(
    { context: controllerContext, resources: resourceContract },
    {
      executeFile: (file, argv) => {
        calls.push([file, argv]);
        return { stderr: '', stdout: '' };
      },
      files: { paths: {} },
      guard: async () => ({}),
      lstat: async () => ({}),
      network: {},
      readRestoredRegistration: async () => undefined,
      receipts: {},
      sealer: {},
    }
  );
  await system('restore-capture', {});
  await system('release-lock', {});
  assert.deepEqual(calls, [
    [
      '/srv/baci-cwv/sealed/campaign-restore.sh',
      [
        controllerContext.campaignId,
        controllerContext.captureSha256,
        '--defer-lease-release',
        JSON.stringify({
          captureSha256: controllerContext.captureSha256,
          disposition: 'retry-block',
          schemaVersion: 1,
        }),
      ],
    ],
    [
      '/srv/baci-cwv/sealed/campaign-restore.sh',
      [
        controllerContext.campaignId,
        controllerContext.captureSha256,
        '--release-lease',
      ],
    ],
  ]);
});
