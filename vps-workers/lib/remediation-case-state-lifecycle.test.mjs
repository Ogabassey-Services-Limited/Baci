import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemediationCaseState } from './remediation-case-state.mjs';

const candidate = () => ({
  category: 'sentry_issue',
  fingerprint: 'issue-42',
  firstSeen: '2026-08-01T10:00:00.000Z',
  lastSeen: '2026-08-01T10:03:00.000Z',
  occurrences: 3,
  sample: { issueId: '42', source: 'sentry' },
  source: 'sentry',
});

describe('remediation case state lifecycle', () => {
  it('quiets an open case at the exact seven-day boundary', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-exact-quiet-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-08T10:03:00.000Z'),
      path: join(directory, 'cases.json'),
    });

    state.reconcile([candidate()]);

    assert.equal(
      state.snapshot().cases['sentry:sentry_issue:issue-42'].status,
      'quiet'
    );
  });

  it('returns enriched lifecycle copies without mutating selection or outcome callers', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-copies-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-01T10:04:00.000Z'),
      path: join(directory, 'cases.json'),
    });
    const selected = state.reconcile([candidate()])[0];
    const selectionInput = structuredClone(selected);

    const selections = state.recordSelections([selected]);

    assert.deepEqual(selected, selectionInput);
    assert.notEqual(selections[0], selected);
    assert.equal(selections[0].status, 'investigating');

    const outcomeInput = structuredClone(selections[0]);
    const outcome = state.recordOutcome(selections[0], { type: 'no_changes' });

    assert.deepEqual(selections[0], outcomeInput);
    assert.notEqual(outcome, selections[0]);
    assert.equal(outcome.history[0].type, 'no_changes');
  });
});
