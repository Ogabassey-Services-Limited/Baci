import assert from 'node:assert/strict';
import { it } from 'node:test';
import { createRemediationDraftPrReconciler } from './remediation-draft-pr-reconciliation.mjs';

it('reuses only the open draft for an observation-scoped branch', () => {
  const calls = [];
  const reconciler = createRemediationDraftPrReconciler({
    candidate: {
      caseKey: 'sentry:sentry_issue:issue-42',
      category: 'sentry_issue',
      fingerprint: 'issue-42',
      observationMarker: '2026-08-09T10:00:00.000Z',
      source: 'sentry',
    },
    ghBin: 'gh',
    options: {
      cwd: '/repo',
      env: { GH_TOKEN: 'token' },
      runner(command, args) {
        calls.push([command, ...args]);
        return {
          status: 0,
          stderr: '',
          stdout:
            command === 'gh'
              ? '[{"url":"https://github.com/ogabasseyy/Baci/pull/999"}]\n'
              : '',
        };
      },
    },
  });

  assert.match(
    reconciler.branch,
    /^codex\/sentry-remediation-sentry-issue-issue-42-[a-f0-9]{12}$/
  );
  assert.equal(
    reconciler.existingDraftPrUrl(),
    'https://github.com/ogabasseyy/Baci/pull/999'
  );
  assert.deepEqual(calls[0].slice(0, 2), ['gh', 'pr']);
  assert.equal(calls[0][calls[0].indexOf('--head') + 1], reconciler.branch);
  assert.equal(calls[0][calls[0].indexOf('--state') + 1], 'open');
});
