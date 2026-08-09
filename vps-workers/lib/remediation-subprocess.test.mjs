import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runRemediationChecked } from './remediation-subprocess.mjs';

describe('remediation checked subprocess', () => {
  it('returns stdout from a successful command', () => {
    const result = runRemediationChecked('git', ['status'], {
      cwd: '/repo',
      env: {},
      runner: () => ({ status: 0, stdout: ' M file.ts\n', stderr: '' }),
    });

    assert.equal(result, ' M file.ts\n');
  });

  it('rejects a nonzero command with bounded diagnostics', () => {
    assert.throws(
      () =>
        runRemediationChecked('git', ['status'], {
          cwd: '/repo',
          env: {},
          runner: () => ({
            status: 1,
            stdout: '',
            stderr: 'permission denied',
          }),
        }),
      /permission denied/
    );
  });
});
