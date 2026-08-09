import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { createRemediationCaseState } from './remediation-case-state.mjs';

const day = 24 * 60 * 60 * 1_000;
const candidate = (overrides = {}) => ({
  category: 'sentry_issue',
  fingerprint: 'issue-42',
  firstSeen: '2026-08-01T10:00:00.000Z',
  lastSeen: '2026-08-01T10:03:00.000Z',
  occurrences: 3,
  sample: {
    issueId: '42',
    message: 'Application Not Responding',
    project: 'mobile',
    source: 'sentry',
  },
  source: 'sentry',
  ...overrides,
});

describe('remediation case state', () => {
  it('persists a redacted provider-specific case only when its observation advances', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-state-'));
    const path = join(directory, 'cases.json');
    let nowMs = Date.parse('2026-08-01T10:04:00.000Z');
    const state = createRemediationCaseState({ now: () => nowMs, path });
    const first = candidate({
      sample: {
        ...candidate().sample,
        message:
          'Authorization: Bearer ghp_abcdefghijklmnopqrstuvwxyz0123456789',
      },
    });

    state.reconcile([first]);
    state.reconcile([first]);
    const advanced = candidate({
      lastSeen: '2026-08-01T10:05:00.000Z',
      occurrences: 5,
    });
    nowMs += 60_000;
    state.reconcile([advanced]);

    const stored = state.snapshot().cases['sentry:sentry_issue:issue-42'];
    assert.equal(stored.firstSeen, '2026-08-01T10:00:00.000Z');
    assert.equal(stored.lastSeen, '2026-08-01T10:05:00.000Z');
    assert.equal(stored.totalObservations, 5);
    assert.equal(stored.status, 'open');
    assert.equal(stored.recurrenceCount, 1);
    assert.match(readFileSync(path, 'utf8'), /\[REDACTED\]/);
    assert.doesNotMatch(
      readFileSync(path, 'utf8'),
      /ghp_abcdefghijklmnopqrstuvwxyz0123456789/
    );
  });

  it('records a recurrence when the occurrence count advances at the same timestamp', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-state-tie-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-01T10:04:00.000Z'),
      path: join(directory, 'cases.json'),
    });

    state.reconcile([candidate()]);
    const recurrence = state.reconcile([candidate({ occurrences: 5 })]);
    const stored = state.snapshot().cases['sentry:sentry_issue:issue-42'];

    assert.equal(recurrence.length, 1);
    assert.equal(stored.totalObservations, 5);
    assert.equal(stored.recurrenceCount, 1);
  });

  it('does not retain a draft lifecycle when a PR result has no URL', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-state-pr-url-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-01T10:04:00.000Z'),
      path: join(directory, 'cases.json'),
    });

    state.reconcile([candidate()]);
    const recorded = state.recordOutcome(candidate(), { type: 'pr_opened' });

    assert.equal(recorded.status, 'open');
    assert.equal(recorded.draftPr, null);
  });

  it('quiets a stale active draft case without resolving it on a newer observation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-quiet-'));
    const path = join(directory, 'cases.json');
    let nowMs = Date.parse('2026-08-01T10:04:00.000Z');
    const state = createRemediationCaseState({ now: () => nowMs, path });

    state.reconcile([candidate()]);
    state.recordOutcome(candidate(), {
      prUrl: 'https://github.com/baci/baci/pull/12',
      type: 'pr_opened',
    });
    nowMs += 7 * day;
    state.reconcile([]);

    assert.equal(
      state.snapshot().cases['sentry:sentry_issue:issue-42'].status,
      'quiet'
    );
    assert.equal(
      state.snapshot().cases['sentry:sentry_issue:issue-42'].draftPr.url,
      'https://github.com/baci/baci/pull/12'
    );

    const recurrence = state.reconcile([
      candidate({
        lastSeen: '2026-08-08T10:05:00.000Z',
        occurrences: 4,
      }),
    ]);

    const recurring = state.snapshot().cases['sentry:sentry_issue:issue-42'];
    assert.equal(recurrence[0].autofixEligible, false);
    assert.equal(recurrence[0].lifecycleEvent, 'active_draft_recurrence');
    assert.equal(recurring.status, 'pr_open');
    assert.equal(recurring.recurrenceCount, 1);
    assert.equal(recurring.draftPr.url, 'https://github.com/baci/baci/pull/12');
  });

  it('keeps an active draft PR open when a newer observation recurs', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-active-pr-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-01T10:04:00.000Z'),
      path: join(directory, 'cases.json'),
    });
    state.reconcile([candidate()]);
    state.recordOutcome(candidate(), {
      prUrl: 'https://github.com/baci/baci/pull/12',
      type: 'pr_opened',
    });

    const selected = state.reconcile([
      candidate({
        lastSeen: '2026-08-01T10:05:00.000Z',
        occurrences: 4,
      }),
    ]);

    const stored = state.snapshot().cases['sentry:sentry_issue:issue-42'];
    assert.equal(selected.length, 1);
    assert.equal(selected[0].autofixEligible, false);
    assert.equal(selected[0].lifecycleEvent, 'active_draft_recurrence');
    assert.equal(stored.status, 'pr_open');
    assert.equal(stored.recurrenceCount, 1);
  });

  it('keeps a quiet case with active draft linkage out of autofix selection after recurrence', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-quiet-draft-'));
    let nowMs = Date.parse('2026-08-01T10:04:00.000Z');
    const state = createRemediationCaseState({
      now: () => nowMs,
      path: join(directory, 'cases.json'),
    });
    state.reconcile([candidate()]);
    state.recordOutcome(candidate(), {
      prUrl: 'https://github.com/baci/baci/pull/12',
      type: 'pr_opened',
    });
    nowMs += 7 * day;
    state.reconcile([]);

    const selected = state.reconcile([
      candidate({
        lastSeen: '2026-08-08T10:05:00.000Z',
        occurrences: 4,
      }),
    ]);

    const stored = state.snapshot().cases['sentry:sentry_issue:issue-42'];
    assert.equal(selected.length, 1);
    assert.equal(selected[0].autofixEligible, false);
    assert.equal(selected[0].lifecycleEvent, 'active_draft_recurrence');
    assert.equal(stored.status, 'pr_open');
    assert.equal(stored.recurrenceCount, 1);
    assert.equal(stored.draftPr.url, 'https://github.com/baci/baci/pull/12');
  });

  it('fails closed for corrupt or schema-invalid persisted case state', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-corrupt-'));
    const path = join(directory, 'cases.json');
    const state = createRemediationCaseState({ path });
    const invalidStates = [
      '{not json',
      JSON.stringify({ cases: {}, fairness: {}, version: 9 }),
      JSON.stringify({ cases: [], fairness: {}, version: 1 }),
      JSON.stringify({
        cases: { broken: { status: 'open' } },
        fairness: {},
        version: 1,
      }),
    ];

    for (const invalid of invalidStates) {
      writeFileSync(path, invalid);
      assert.throws(() => state.snapshot(), /Invalid remediation case state/);
    }
  });

  it('rejects bloated and arbitrary-key lifecycle state records', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-bounds-'));
    const path = join(directory, 'cases.json');
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-01T10:04:00.000Z'),
      path,
    });
    state.reconcile([candidate()]);
    const valid = JSON.parse(readFileSync(path, 'utf8'));
    const caseKey = Object.keys(valid.cases)[0];
    const invalidStates = [
      { ...valid, unexpected: true },
      {
        ...valid,
        cases: {
          ...valid.cases,
          [caseKey]: {
            ...valid.cases[caseKey],
            samples: [{ ...valid.cases[caseKey].samples[0], extra: 'value' }],
          },
        },
      },
      {
        ...valid,
        fairness: { lastCategory: 'x'.repeat(81) },
      },
      {
        ...valid,
        cases: {
          ...valid.cases,
          [caseKey]: {
            ...valid.cases[caseKey],
            samples: [
              {
                ...valid.cases[caseKey].samples[0],
                message: 'x'.repeat(1_001),
              },
            ],
          },
        },
      },
    ];

    for (const invalid of invalidStates) {
      writeFileSync(path, JSON.stringify(invalid));
      assert.throws(() => state.snapshot(), /Invalid remediation case state/);
    }
  });

  it('does not keep selecting a stale cumulative candidate after seven quiet days', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-stale-loader-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-08T10:03:00.000Z'),
      path: join(directory, 'cases.json'),
    });

    const reconciled = state.reconcile([candidate()]);

    assert.deepEqual(reconciled, []);
    assert.equal(
      state.snapshot().cases['sentry:sentry_issue:issue-42'].status,
      'quiet'
    );
  });

  it('round-robins categories so a noisy category cannot exhaust a run', () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-case-fairness-'));
    const state = createRemediationCaseState({
      now: () => Date.parse('2026-08-01T10:04:00.000Z'),
      path: join(directory, 'cases.json'),
    });
    const candidates = [
      candidate({
        fingerprint: 'runtime-1',
        category: 'vercel_runtime_exception',
        source: 'vercel',
        sample: { source: 'vercel' },
      }),
      candidate({
        fingerprint: 'runtime-2',
        category: 'vercel_runtime_exception',
        source: 'vercel',
        sample: { source: 'vercel' },
      }),
      candidate({
        fingerprint: 'runtime-3',
        category: 'vercel_runtime_exception',
        source: 'vercel',
        sample: { source: 'vercel' },
      }),
      candidate({
        fingerprint: 'timeout-1',
        category: 'vercel_timeout',
        source: 'vercel',
        sample: { source: 'vercel' },
      }),
    ];

    const ordered = state.orderCandidates(state.reconcile(candidates));

    assert.deepEqual(
      ordered.slice(0, 2).map((value) => value.category),
      ['vercel_runtime_exception', 'vercel_timeout']
    );
  });
});
