import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { writeRemediationResultArtifact } from './remediation-result-artifact.mjs';

describe('remediation result artifact', () => {
  it('persists a private human-reviewable Codex investigation', () => {
    const outputDir = mkdtempSync(join(tmpdir(), 'baci-remediation-result-'));

    const path = writeRemediationResultArtifact({
      candidate: { fingerprint: 'candidate/../../unsafe' },
      output: 'No safe production change was identified.\n',
      outputDir,
    });

    assert.equal(path, join(outputDir, 'candidate-------unsafe.result.md'));
    assert.match(readFileSync(path, 'utf8'), /No safe production change/);
    assert.equal(statSync(path).mode & 0o777, 0o600);
  });

  it('does not write outside an explicitly configured output directory', () => {
    assert.equal(
      writeRemediationResultArtifact({
        candidate: { fingerprint: 'abc123' },
        output: 'review',
      }),
      undefined
    );
  });
});
