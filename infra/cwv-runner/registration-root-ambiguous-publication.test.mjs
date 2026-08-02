import assert from 'node:assert/strict';
import test from 'node:test';

import {
  controllerContext,
  resourceContract,
} from './controller-contract.fixture.mjs';
import { createRegistrationSystemOperations } from './registration-root-system.mjs';

test('refuses ambiguous registration publication unless hashes are lowercase and egress-bound', async () => {
  const published = [];
  const system = createRegistrationSystemOperations(
    { context: controllerContext, resources: resourceContract },
    {
      executeFile: async () => ({ stderr: '', stdout: '' }),
      files: { paths: {} },
      network: {
        activateEgress: async () => ({
          activeEgressRuleSha256: 'a'.repeat(64),
        }),
      },
      receipts: {},
      sealer: {},
      readRegistrationCommand: async () => Buffer.from('sealed-command'),
      recordJournalEntry: async () => ({ sha256: 'b'.repeat(64) }),
      publishRegistrationRetryBlock: (value) => {
        published.push(value);
        return value;
      },
      verifyAuthority: async () => undefined,
    }
  );
  await system('activate-registration-egress', {});

  await assert.rejects(
    system('mark-registration-ambiguous', {
      cleanupSha256: 'C'.repeat(64),
      egressReleaseSha256: 'b'.repeat(64),
    }),
    /registration root operation refused/
  );
  await assert.rejects(
    system('mark-registration-ambiguous', {
      cleanupSha256: 'c'.repeat(64),
      egressReleaseSha256: 'd'.repeat(64),
    }),
    /registration root system refused/
  );
  assert.deepEqual(published, []);
});
