import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { runVercelErrorRemediator } from './vercel-error-remediator.mjs';

const silentLogger = {
  error: () => undefined,
  log: () => undefined,
  warn: () => undefined,
};

describe('vercel remediator state lock', () => {
  it('does not classify or rerun a successful PR when checkpointing is busy', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'baci-remediator-lock-'));
    const logPath = join(directory, 'vercel.jsonl');
    const configuredStatePath = join(directory, 'state.json');
    const lockPath = join(directory, 'state.autofix.json.lock');
    writeFileSync(
      logPath,
      [
        JSON.stringify({ level: 'error', message: 'Error: lock', route: '/a' }),
        JSON.stringify({ level: 'error', message: 'Error: lock', route: '/a' }),
      ].join('\n')
    );
    const env = {
      BACI_REMEDIATION_AUTOFIX_ENABLED: '1',
      BACI_REMEDIATION_OUTPUT_DIR: join(directory, 'out'),
      BACI_REMEDIATION_STATE_PATH: configuredStatePath,
      VERCEL_ERROR_LOG_PATH: logPath,
    };
    let autofixCalls = 0;
    const autofixRunner = () => {
      autofixCalls += 1;
      writeFileSync(lockPath, 'busy');
      return { type: 'pr_opened', prUrl: 'https://example.test/pr/1' };
    };

    await assert.rejects(
      runVercelErrorRemediator({ autofixRunner, env, logger: silentLogger }),
      /remediation state is busy/
    );
    unlinkSync(lockPath);

    const retry = await runVercelErrorRemediator({
      autofixRunner,
      env,
      logger: silentLogger,
    });
    assert.equal(retry.candidates.length, 0);
    assert.equal(autofixCalls, 1);
  });
});
