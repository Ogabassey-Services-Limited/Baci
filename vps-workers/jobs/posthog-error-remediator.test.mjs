import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runPostHogErrorRemediator } from './posthog-error-remediator.mjs';

const silentLogger = {
  error: () => undefined,
  log: () => undefined,
  warn: () => undefined,
};

describe('PostHog error remediator', () => {
  it('writes and deduplicates a repeated active PostHog error-tracking issue', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'posthog-remediator-'));
    const env = {
      BACI_POSTHOG_REMEDIATION_OUTPUT_DIR: directory,
      POSTHOG_REMEDIATION_HOST: 'https://eu.posthog.com',
      POSTHOG_REMEDIATION_PERSONAL_API_KEY: 'phx_read_only_personal_key',
      POSTHOG_REMEDIATION_PROJECT_ID: '202711',
    };
    const fetchFn = async () =>
      new Response(
        JSON.stringify({
          count: 1,
          results: [
            { id: 'posthog-issue-1', status: 'active', events_count: 2 },
          ],
        })
      );

    const first = await runPostHogErrorRemediator({
      env,
      fetchFn,
      logger: silentLogger,
    });
    const second = await runPostHogErrorRemediator({
      env,
      fetchFn,
      logger: silentLogger,
    });

    assert.equal(first.candidates.length, 1);
    assert.equal(first.actions[0].type, 'prompt_written');
    assert.equal(second.candidates.length, 0);
    assert.deepEqual(
      second.actions.map((action) => action.type),
      ['email_skipped']
    );
  });

  it('rejects a public PostHog ingestion key before making a request', async () => {
    await assert.rejects(
      runPostHogErrorRemediator({
        env: {
          BACI_POSTHOG_REMEDIATION_OUTPUT_DIR: mkdtempSync(
            join(tmpdir(), 'posthog-remediator-')
          ),
          POSTHOG_REMEDIATION_HOST: 'https://eu.posthog.com',
          POSTHOG_REMEDIATION_PERSONAL_API_KEY: 'phc_public_ingestion_key',
          POSTHOG_REMEDIATION_PROJECT_ID: '202711',
        },
        fetchFn: () => {
          throw new Error('fetch must not run with an ingestion key');
        },
        logger: silentLogger,
      }),
      /personal API key.*not a project ingestion key/i
    );
  });
});
