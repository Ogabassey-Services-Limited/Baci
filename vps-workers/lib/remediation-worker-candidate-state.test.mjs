import assert from 'node:assert/strict';
import { it } from 'node:test';
import { recordRemediationOutcome } from './remediation-worker-candidate-state.mjs';

it('replaces the selected candidate with its recorded lifecycle snapshot', () => {
  const candidate = {
    caseKey: 'sentry:sentry_issue:1',
    status: 'investigating',
  };
  const recorded = {
    ...candidate,
    history: [{ type: 'autofix_failed' }],
    status: 'open',
  };
  const result = recordRemediationOutcome({
    candidate,
    candidates: [candidate],
    caseState: { recordOutcome: () => recorded },
    outcome: { type: 'autofix_failed' },
    pendingCandidate: candidate,
  });

  assert.deepEqual(result, [recorded]);
  assert.equal(candidate.status, 'investigating');
});
