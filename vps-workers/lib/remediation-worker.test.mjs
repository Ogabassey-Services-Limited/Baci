import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRemediationWorker } from './remediation-worker.mjs';

describe('remediation worker', () => {
  it('requires an explicit incident candidate loader', async () => {
    await assert.rejects(
      runRemediationWorker({ workerName: 'test-remediator' }),
      /candidateLoader is required/
    );
  });

  it('requires a source-specific worker name', async () => {
    await assert.rejects(
      runRemediationWorker({ candidateLoader: async () => [] }),
      /workerName is required/
    );
  });
});
