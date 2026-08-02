import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./cloudflare-evidence-run-journal', () => ({
  loadEvidenceRunForCleanup: vi.fn(async () => ({
    toolingMergeSha: 'a'.repeat(40),
    measurementRunnerModulePath: '/tmp/measurement-runner.ts',
    measurementRunnerModuleSha256: 'b'.repeat(64),
  })),
}));

import { loadMeasurementDependencies } from './measure-cloudflare-evidence-sources-loader';

describe('loadMeasurementDependencies', () => {
  const originalWorkspaceRoot = process.env.EVIDENCE_WORKSPACE_ROOT;

  afterEach(() => {
    if (originalWorkspaceRoot === undefined)
      delete process.env.EVIDENCE_WORKSPACE_ROOT;
    else process.env.EVIDENCE_WORKSPACE_ROOT = originalWorkspaceRoot;
  });

  it('requires the reviewed workspace before importing a provider runner', async () => {
    delete process.env.EVIDENCE_WORKSPACE_ROOT;

    await expect(
      loadMeasurementDependencies('0123456789abcdef0123456789abcdef', '/tmp')
    ).rejects.toThrow('absolute EVIDENCE_WORKSPACE_ROOT is required');
  });
});
