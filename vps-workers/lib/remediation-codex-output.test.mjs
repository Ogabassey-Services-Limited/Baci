import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertCodexExecutionUsable } from './remediation-codex-output.mjs';

describe('Codex remediation output', () => {
  it('rejects the VPS bubblewrap failure instead of treating it as no changes', () => {
    assert.throws(
      () =>
        assertCodexExecutionUsable(
          'Blocked: bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted'
        ),
      /sandbox failed before repository inspection/
    );
  });

  it('rejects the legacy Landlock permission-profile failure', () => {
    assert.throws(
      () =>
        assertCodexExecutionUsable(
          'permission profiles requiring direct runtime enforcement are incompatible with --use-legacy-landlock'
        ),
      /sandbox failed before repository inspection/
    );
  });

  it('accepts a completed investigation report', () => {
    assert.doesNotThrow(() =>
      assertCodexExecutionUsable('No production change is needed for HTTP 200.')
    );
  });
});
