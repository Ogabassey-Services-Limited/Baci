import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runVercelErrorRemediator } from './vercel-error-remediator.mjs';

const silentLogger = {
  error: () => undefined,
  log: () => undefined,
  warn: () => undefined,
};

function makeRepeatedErrorFixture(message) {
  const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-'));
  const logPath = join(directory, 'vercel.jsonl');
  writeFileSync(
    logPath,
    [
      JSON.stringify({ level: 'error', message, route: '/a' }),
      JSON.stringify({ level: 'error', message, route: '/a' }),
    ].join('\n')
  );
  return { directory, logPath };
}

describe('vercel error remediator retries', () => {
  it('retries failed email delivery without repeating autofix', async () => {
    const { directory, logPath } = makeRepeatedErrorFixture('Error: retry');
    const env = {
      VERCEL_ERROR_LOG_PATH: logPath,
      BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
      BACI_REMEDIATION_OUTPUT_DIR: join(directory, 'out'),
      BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
      ZEPTOMAIL_TOKEN: 'token',
    };
    let autofixCalls = 0;
    const autofixRunner = () => {
      autofixCalls += 1;
      return { type: 'no_changes' };
    };

    const failed = await runVercelErrorRemediator({
      autofixRunner,
      env,
      logger: silentLogger,
      fetchFn: () => new Response('down', { status: 503 }),
    });
    const delivered = await runVercelErrorRemediator({
      autofixRunner,
      env,
      logger: silentLogger,
      fetchFn: () => new Response('', { status: 200 }),
    });
    const deduplicated = await runVercelErrorRemediator({
      env,
      logger: silentLogger,
    });

    assert.equal(failed.candidates.length, 1);
    assert.equal(delivered.candidates.length, 0);
    assert.equal(delivered.email.skipped, false);
    assert.equal(deduplicated.candidates.length, 0);
    assert.equal(autofixCalls, 1);
  });

  it('backs off a candidate after an autofix configuration block', async () => {
    const { directory, logPath } = makeRepeatedErrorFixture(
      'Error: configuration retry'
    );
    const env = {
      VERCEL_ERROR_LOG_PATH: logPath,
      BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
      BACI_REMEDIATION_OUTPUT_DIR: join(directory, 'out'),
    };
    let autofixCalls = 0;
    const autofixRunner = () => {
      autofixCalls += 1;
      return {
        type: autofixCalls === 1 ? 'configuration_blocked' : 'no_changes',
      };
    };

    const blocked = await runVercelErrorRemediator({
      autofixRunner,
      env,
      logger: silentLogger,
    });
    const retried = await runVercelErrorRemediator({
      autofixRunner,
      env,
      logger: silentLogger,
    });

    assert.equal(blocked.candidates.length, 1);
    assert.equal(blocked.actions.at(-1).type, 'configuration_blocked');
    assert.equal(retried.candidates.length, 0);
    assert.equal(retried.actions.length, 0);
    assert.equal(autofixCalls, 1);
  });
});
