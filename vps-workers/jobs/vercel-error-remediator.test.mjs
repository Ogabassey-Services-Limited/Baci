import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runVercelErrorRemediator } from './vercel-error-remediator.mjs';

const silentLogger = {
  error: () => undefined,
  log: () => undefined,
  warn: () => undefined,
};

describe('vercel error remediator worker', () => {
  it('writes prompts for repeated error candidates in dry-run mode', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-'));
    const logPath = join(directory, 'vercel.jsonl');
    const outputDir = join(directory, 'out');
    writeFileSync(
      logPath,
      [
        JSON.stringify({
          level: 'error',
          message: 'TypeError: Cannot read properties of undefined',
          route: '/api/products',
          deploymentId: 'dpl_123',
        }),
        JSON.stringify({
          level: 'error',
          message: 'TypeError: Cannot read properties of undefined',
          route: '/api/products',
          deploymentId: 'dpl_123',
        }),
      ].join('\n')
    );

    const result = await runVercelErrorRemediator({
      env: {
        VERCEL_ERROR_LOG_PATH: logPath,
        BACI_REMEDIATION_OUTPUT_DIR: outputDir,
        BACI_REMEDIATION_MIN_OCCURRENCES: '2',
      },
      logger: silentLogger,
      fetchFn: () => {
        throw new Error('email should be skipped');
      },
    });

    assert.equal(result.candidates.length, 1);
    assert.equal(result.actions[0].type, 'prompt_written');
    assert.match(readFileSync(result.actions[0].path, 'utf8'), /TypeError/);
    assert.equal(result.email.skipped, true);
  });

  it('does not generate work for one-off events below threshold', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-'));
    const logPath = join(directory, 'vercel.jsonl');
    writeFileSync(
      logPath,
      JSON.stringify({
        level: 'error',
        message: 'Error: one off',
        route: '/api/products',
      })
    );

    const result = await runVercelErrorRemediator({
      env: {
        VERCEL_ERROR_LOG_PATH: logPath,
        BACI_REMEDIATION_OUTPUT_DIR: join(directory, 'out'),
        BACI_REMEDIATION_MIN_OCCURRENCES: '2',
      },
      logger: silentLogger,
    });

    assert.equal(result.candidates.length, 0);
    assert.deepEqual(result.actions, []);
  });

  it('continues processing candidates when one autofix fails', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-'));
    const logPath = join(directory, 'vercel.jsonl');
    writeFileSync(
      logPath,
      [
        JSON.stringify({
          level: 'error',
          message: 'Error: first',
          route: '/a',
        }),
        JSON.stringify({
          level: 'error',
          message: 'Error: first',
          route: '/a',
        }),
        JSON.stringify({
          level: 'error',
          message: 'Error: second',
          route: '/b',
        }),
        JSON.stringify({
          level: 'error',
          message: 'Error: second',
          route: '/b',
        }),
      ].join('\n')
    );
    let calls = 0;

    const result = await runVercelErrorRemediator({
      env: {
        VERCEL_ERROR_LOG_PATH: logPath,
        BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
        BACI_REMEDIATION_OUTPUT_DIR: join(directory, 'out'),
      },
      logger: silentLogger,
      autofixRunner() {
        calls += 1;
        if (calls === 1) {
          throw new Error('codex failed');
        }
        return {
          type: 'pr_opened',
          prUrl: 'https://github.com/ogabasseyy/Baci/pull/1',
        };
      },
    });

    assert.equal(result.candidates.length, 2);
    assert.equal(
      result.actions.some((action) => action.type === 'autofix_failed'),
      true
    );
    assert.equal(
      result.actions.some((action) => action.type === 'pr_opened'),
      true
    );
  });

  it('reports email failures without failing the worker', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-'));
    const logPath = join(directory, 'vercel.jsonl');
    writeFileSync(
      logPath,
      [
        JSON.stringify({
          level: 'error',
          message: 'Error: email',
          route: '/a',
        }),
        JSON.stringify({
          level: 'error',
          message: 'Error: email',
          route: '/a',
        }),
      ].join('\n')
    );

    const result = await runVercelErrorRemediator({
      env: {
        VERCEL_ERROR_LOG_PATH: logPath,
        BACI_REMEDIATION_OUTPUT_DIR: join(directory, 'out'),
        BACI_REMEDIATION_NOTIFY_EMAILS: 'ops@example.com',
        ZEPTOMAIL_TOKEN: 'token',
      },
      logger: silentLogger,
      fetchFn: () => new Response('down', { status: 503 }),
    });

    assert.deepEqual(result.email, {
      error: 'ZeptoMail report failed with HTTP 503: down',
      skipped: true,
    });
    assert.equal(
      result.actions.some((action) => action.type === 'email_failed'),
      true
    );
    assert.match(result.report.text, /email_failed/);
  });
});
