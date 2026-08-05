import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runSentryMobileErrorRemediator } from './sentry-mobile-error-remediator.mjs';

const silentLogger = {
  error: () => undefined,
  log: () => undefined,
  warn: () => undefined,
};

describe('Sentry mobile error remediator', () => {
  it('writes one prompt for a repeated native issue and deduplicates it', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'sentry-remediator-'));
    const env = {
      BACI_SENTRY_REMEDIATION_OUTPUT_DIR: directory,
      SENTRY_AUTH_TOKEN: 'token',
      SENTRY_ORG: 'ogabassey',
      SENTRY_PROJECT: 'storefront',
    };
    const fetchFn = async () =>
      new Response(
        JSON.stringify([
          {
            id: 'anr-1',
            count: '2',
            title: 'Application Not Responding',
            culprit: 'MainActivity',
            lastSeen: '2026-08-04T15:46:50Z',
          },
        ])
      );

    const first = await runSentryMobileErrorRemediator({
      env,
      fetchFn,
      logger: silentLogger,
    });
    const second = await runSentryMobileErrorRemediator({
      env,
      fetchFn,
      logger: silentLogger,
    });

    assert.equal(first.candidates.length, 1);
    assert.equal(first.actions[0].type, 'prompt_written');
    assert.equal(second.candidates.length, 0);
    assert.deepEqual(second.actions, []);
  });
});
