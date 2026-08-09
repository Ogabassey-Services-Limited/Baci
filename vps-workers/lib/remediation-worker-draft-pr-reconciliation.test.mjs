import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runRemediationWorker } from './remediation-worker.mjs';

function createTestDirectory(t, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(directory, { force: true, recursive: true }));
  return directory;
}

describe('remediation worker draft PR reconciliation', () => {
  for (const terminalState of ['closed', 'merged']) {
    it(`reopens a recurring case after its linked draft PR is ${terminalState}`, async (t) => {
      const directory = createTestDirectory(
        t,
        `baci-worker-${terminalState}-draft-`
      );
      let attempts = 0;
      let observedAt = '2026-08-01T10:00:00.000Z';
      const env = {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      };
      const candidateLoader = async () => [
        {
          category: 'sentry_issue',
          fingerprint: `issue-${terminalState}-draft`,
          lastSeen: observedAt,
          occurrences: observedAt.endsWith('00.000Z') ? 2 : 3,
          sample: { issueId: terminalState, source: 'sentry' },
          source: 'sentry',
        },
      ];
      const autofixRunner = () => {
        attempts += 1;
        return {
          branch: `codex/fix-${terminalState}-draft-${attempts}`,
          prUrl: `https://github.com/baci/baci/pull/${50 + attempts}`,
          type: 'pr_opened',
        };
      };

      await runRemediationWorker({
        autofixRunner,
        candidateLoader,
        env,
        now: () => Date.parse('2026-08-01T10:02:00.000Z'),
        workerName: 'test-remediator',
      });
      observedAt = '2026-08-01T10:01:00.000Z';
      await runRemediationWorker({
        autofixRunner,
        candidateLoader,
        draftPrStatusResolver: () => terminalState,
        env,
        now: () => Date.parse('2026-08-01T10:03:00.000Z'),
        workerName: 'test-remediator',
      });

      assert.equal(attempts, 2);
      const lifecycle = JSON.parse(
        readFileSync(join(directory, 'case-state.autofix.json'), 'utf8')
      );
      const stored =
        lifecycle.cases[`sentry:sentry_issue:issue-${terminalState}-draft`];
      assert.equal(stored.status, 'pr_open');
      assert.equal(stored.draftPr.url, 'https://github.com/baci/baci/pull/52');
      assert.equal(stored.outcomes.at(-2).type, `draft_pr_${terminalState}`);
    });
  }

  it('continues suppressing a recurrence when draft PR reconciliation fails', async (t) => {
    const directory = createTestDirectory(t, 'baci-worker-draft-api-failure-');
    let attempts = 0;
    let observedAt = '2026-08-01T10:00:00.000Z';
    const env = {
      BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
      BACI_REMEDIATION_OUTPUT_DIR: directory,
    };
    const candidateLoader = async () => [
      {
        category: 'sentry_issue',
        fingerprint: 'issue-draft-api-failure',
        lastSeen: observedAt,
        occurrences: observedAt.endsWith('00.000Z') ? 2 : 3,
        sample: { issueId: 'api-failure', source: 'sentry' },
        source: 'sentry',
      },
    ];
    const autofixRunner = () => {
      attempts += 1;
      return {
        branch: 'codex/fix-draft-api-failure',
        prUrl: 'https://github.com/baci/baci/pull/60',
        type: 'pr_opened',
      };
    };

    await runRemediationWorker({
      autofixRunner,
      candidateLoader,
      env,
      now: () => Date.parse('2026-08-01T10:02:00.000Z'),
      workerName: 'test-remediator',
    });
    observedAt = '2026-08-01T10:01:00.000Z';
    const result = await runRemediationWorker({
      autofixRunner,
      candidateLoader,
      draftPrStatusResolver: () => {
        throw new Error('GitHub API unavailable');
      },
      env,
      now: () => Date.parse('2026-08-01T10:03:00.000Z'),
      workerName: 'test-remediator',
    });

    assert.equal(attempts, 1);
    assert.equal(
      result.actions.some(
        (action) => action.type === 'draft_pr_reconciliation_failed'
      ),
      true
    );
    const lifecycle = JSON.parse(
      readFileSync(join(directory, 'case-state.autofix.json'), 'utf8')
    );
    const stored =
      lifecycle.cases['sentry:sentry_issue:issue-draft-api-failure'];
    assert.equal(stored.status, 'pr_open');
    assert.equal(stored.draftPr.url, 'https://github.com/baci/baci/pull/60');
  });
});
