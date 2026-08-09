import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { writeRemediationPrompt } from './remediation-prompt-file.mjs';

it('writes prompts under their canonical case identities', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'baci-prompt-file-'));
  const runtimePath = writeRemediationPrompt({
    candidate: {
      category: 'vercel_runtime_exception',
      fingerprint: 'shared',
      sample: { source: 'vercel' },
      source: 'vercel',
    },
    outputDir,
  });
  const timeoutPath = writeRemediationPrompt({
    candidate: {
      category: 'vercel_timeout',
      fingerprint: 'shared',
      sample: { source: 'vercel' },
      source: 'vercel',
    },
    outputDir,
  });

  assert.equal(
    runtimePath,
    join(outputDir, 'vercel-vercel_runtime_exception-shared.prompt.md')
  );
  assert.equal(
    timeoutPath,
    join(outputDir, 'vercel-vercel_timeout-shared.prompt.md')
  );
  assert.notEqual(runtimePath, timeoutPath);
  assert.equal(existsSync(runtimePath), true);
  assert.equal(existsSync(timeoutPath), true);
});
