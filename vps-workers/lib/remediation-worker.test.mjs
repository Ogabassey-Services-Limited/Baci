import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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

  it('caps configurable candidate work per cron tick', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-cap-'));
    const attempted = [];
    const loadedCandidates = Array.from({ length: 4 }, (_, index) => ({
      fingerprint: `candidate-${index}`,
      occurrences: 3,
      sample: { source: 'sentry' },
    }));

    const result = await runRemediationWorker({
      autofixRunner: ({ candidate }) => {
        attempted.push(candidate.fingerprint);
        return { type: 'no_changes' };
      },
      candidateLoader: async () => loadedCandidates,
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_MAX_CANDIDATES_PER_RUN: '2',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(attempted, ['candidate-0', 'candidate-1']);
    assert.equal(result.candidates.length, 2);
  });
});
