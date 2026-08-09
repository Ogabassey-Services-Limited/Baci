import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { finalizeRemediationWorkerReport } from './remediation-worker-reporting.mjs';

const candidate = {
  caseKey: 'sentry:sentry_issue:issue-42',
  category: 'sentry_issue',
  fingerprint: 'issue-42',
  lastSeen: '2026-08-09T10:00:00.000Z',
};

describe('remediation worker reporting', () => {
  it('does not persist or send a report when there are no candidates', async () => {
    const calls = [];

    const result = await finalizeRemediationWorkerReport({
      actions: [],
      candidates: [],
      email: { skipped: true, reason: 'no retry' },
      env: {},
      fetchFn: () => {
        throw new Error('should not send');
      },
      logger: { error: () => calls.push('error') },
      mode: 'dry-run',
      state: {
        acknowledgeNotification: () => calls.push('acknowledge'),
        complete: () => calls.push('complete'),
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(calls, []);
    assert.deepEqual(result.candidates, []);
    assert.equal(result.mode, 'dry-run');
  });

  it('persists the email-skipped action after the first notification checkpoint', async () => {
    const checkpoints = [];
    const actions = [{ type: 'prompt_written' }];

    const result = await finalizeRemediationWorkerReport({
      actions,
      candidates: [candidate],
      email: { skipped: true, reason: 'no retry' },
      env: {},
      fetchFn: () => {
        throw new Error('should not send');
      },
      logger: { error: () => undefined },
      mode: 'dry-run',
      state: {
        acknowledgeNotification: () => undefined,
        complete: (checkpoint) => {
          checkpoints.push(checkpoint);
          return true;
        },
      },
      workerName: 'test-remediator',
    });

    assert.equal(checkpoints.length, 2);
    assert.equal(result.actions.at(-1).type, 'email_skipped');
    assert.match(checkpoints[1].notification.report.text, /email_skipped/);
  });
});
