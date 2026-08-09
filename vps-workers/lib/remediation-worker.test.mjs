import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { assertCodexExecutionUsable } from './remediation-codex-output.mjs';
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

  it('passes the recorded investigating lifecycle into autofix', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-lifecycle-state-'));
    let received;

    await runRemediationWorker({
      autofixRunner: ({ candidate }) => {
        received = candidate;
        return { type: 'no_changes' };
      },
      candidateLoader: async () => [
        {
          fingerprint: 'lifecycle-state',
          occurrences: 2,
          sample: { source: 'sentry' },
        },
      ],
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      workerName: 'test-remediator',
    });

    assert.equal(received.status, 'investigating');
    assert.deepEqual(received.history, []);
  });

  it('reports the persisted draft PR lifecycle after opening a PR', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-pr-report-'));

    const result = await runRemediationWorker({
      autofixRunner: () => ({
        branch: 'codex/fix-pr-report',
        prUrl: 'https://github.com/baci/baci/pull/77',
        type: 'pr_opened',
      }),
      candidateLoader: async () => [
        {
          fingerprint: 'pr-report',
          occurrences: 2,
          sample: { source: 'sentry' },
        },
      ],
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      workerName: 'test-remediator',
    });

    assert.match(result.report.text, /lifecycle=pr_open/);
    assert.match(
      result.report.text,
      /draftPr=https:\/\/github\.com\/baci\/baci\/pull\/77/
    );
  });

  it('enriches only pending candidates before handing evidence to autofix', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-enrichment-'));
    const enriched = [];
    const attempted = [];

    await runRemediationWorker({
      autofixRunner: ({ candidate }) => {
        attempted.push(candidate.sample.release);
        return { type: 'no_changes' };
      },
      candidateEnricher: ({ candidate }) => {
        enriched.push(candidate.fingerprint);
        return {
          ...candidate,
          sample: { ...candidate.sample, release: 'build-769' },
        };
      },
      candidateLoader: async () => [
        { fingerprint: 'first', occurrences: 3, sample: { source: 'sentry' } },
        { fingerprint: 'second', occurrences: 3, sample: { source: 'sentry' } },
      ],
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_MAX_CANDIDATES_PER_RUN: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(enriched, ['first']);
    assert.deepEqual(attempted, ['build-769']);
  });

  it('caps candidate enrichment in dry-run mode', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-enrichment-'));
    const enriched = [];

    const result = await runRemediationWorker({
      candidateEnricher: ({ candidate }) => {
        enriched.push(candidate.fingerprint);
        return candidate;
      },
      candidateLoader: async () => [
        { fingerprint: 'first', occurrences: 3, sample: { source: 'sentry' } },
        { fingerprint: 'second', occurrences: 3, sample: { source: 'sentry' } },
      ],
      env: {
        BACI_REMEDIATION_MAX_CANDIDATES_PER_RUN: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      workerName: 'test-remediator',
    });

    assert.deepEqual(enriched, ['first']);
    assert.equal(result.candidates.length, 1);
  });

  it('defers a candidate when evidence enrichment fails', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-enrichment-'));
    let attempted = false;

    const result = await runRemediationWorker({
      autofixRunner: () => {
        attempted = true;
        return { type: 'no_changes' };
      },
      candidateEnricher: () => {
        throw new Error('latest event unavailable');
      },
      candidateLoader: async () => [
        { fingerprint: 'anr', occurrences: 3, sample: { source: 'sentry' } },
      ],
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      logger: { error: () => undefined, log: () => undefined },
      workerName: 'test-remediator',
    });

    assert.equal(attempted, false);
    assert.deepEqual(result.actions[0], {
      detail: 'latest event unavailable',
      fingerprint: 'anr',
      type: 'candidate_enrichment_failed',
    });
  });

  it('uses the pending candidate when evidence enrichment returns no object', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-enrichment-'));
    const attempted = [];

    await runRemediationWorker({
      autofixRunner: ({ candidate }) => {
        attempted.push(candidate.fingerprint);
        return { type: 'no_changes' };
      },
      candidateEnricher: () => undefined,
      candidateLoader: async () => [
        { fingerprint: 'fallback', occurrences: 3, sample: { source: 'sentry' } },
      ],
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      logger: { error: () => undefined, log: () => undefined },
      workerName: 'test-remediator',
    });

    assert.deepEqual(attempted, ['fallback']);
  });

  it('keeps redacted Codex failures out of logs and email report actions', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-redaction-'));
    const loggedMessages = [];
    const token = 'ghp_abcdefghijklmnopqrstuvwxyz0123456789';

    const result = await runRemediationWorker({
      autofixRunner: () =>
        assertCodexExecutionUsable({
          status: 1,
          stderr: `Authorization: Bearer ${token}\nCodex usage limit reached`,
          stdout: '',
        }),
      candidateLoader: async () => [
        {
          fingerprint: 'redaction',
          occurrences: 3,
          sample: { source: 'sentry' },
        },
      ],
      env: {
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
      },
      logger: {
        error: (_message, error) => loggedMessages.push(error.message),
        log: () => undefined,
      },
      workerName: 'test-remediator',
    });

    const failure = result.actions.find(
      (action) => action.type === 'autofix_failed'
    );
    assert.ok(failure);
    assert.doesNotMatch(failure.detail, new RegExp(token));
    assert.match(failure.detail, /\[REDACTED\]/);
    assert.doesNotMatch(result.report.text, new RegExp(token));
    assert.doesNotMatch(loggedMessages[0], new RegExp(token));
  });

  it('persists an email-failure action in the notification retry report', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-email-failure-'));
    const result = await runRemediationWorker({
      candidateLoader: async () => [
        { fingerprint: 'email-failure', occurrences: 2, sample: { source: 'sentry' } },
      ],
      env: {
        BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
        ZEPTOMAIL_TOKEN: 'configured-token',
      },
      fetchFn: async () => new Response('unavailable', { status: 503 }),
      logger: { error: () => undefined, log: () => undefined },
      workerName: 'test-remediator',
    });

    assert.match(result.report.text, /email_failed/);
    const state = JSON.parse(
      readFileSync(join(directory, 'handled-state.dry-run.json'), 'utf8')
    );
    const notification = Object.values(state.notifications)[0];
    assert.match(notification.report.text, /email_failed/);
  });

  it('keeps ZeptoMail failure bodies out of worker and job-visible output', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-worker-email-privacy-'));
    const stripeLikeToken = [
      'sk',
      'live',
      'abcdefghijklmnopqrstuvwxyz',
    ].join('_');
    const providerBody = `customer@example.test Authorization: Bearer ${stripeLikeToken}`;
    const logged = [];
    const result = await runRemediationWorker({
      candidateLoader: async () => [
        { fingerprint: 'email-privacy', occurrences: 2, sample: { source: 'sentry' } },
      ],
      env: {
        BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
        BACI_REMEDIATION_OUTPUT_DIR: directory,
        ZEPTOMAIL_TOKEN: 'configured-token',
      },
      fetchFn: async () => new Response(providerBody, { status: 503 }),
      logger: {
        error: (_message, error) => logged.push(error.message),
        log: () => undefined,
      },
      workerName: 'test-remediator',
    });
    const jobOutput = JSON.stringify({
      actions: result.actions,
      candidates: result.candidates.length,
      email: result.email,
      mode: result.mode,
    });

    for (const output of [
      ...logged,
      JSON.stringify(result.actions),
      result.email.error,
      result.report.html,
      result.report.text,
      jobOutput,
    ]) {
      assert.doesNotMatch(output, /customer@example\.test/);
      assert.equal(output.includes(stripeLikeToken), false);
    }
    assert.equal(result.email.error, 'ZeptoMail report failed with HTTP 503');
  });
});
