import assert from 'node:assert/strict';
import { existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it } from 'node:test';
import { writeRemediationPrompt } from './remediation-prompt-file.mjs';

it('writes a fingerprint-scoped remediation prompt', () => {
  const outputDir = mkdtempSync(join(tmpdir(), 'baci-prompt-file-'));
  const path = writeRemediationPrompt({
    candidate: {
      category: 'sentry_issue',
      fingerprint: 'issue-1',
      sample: { source: 'sentry' },
      source: 'sentry',
    },
    outputDir,
  });

  assert.equal(existsSync(path), true);
});
