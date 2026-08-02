import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  evidenceExecutionRoot,
  mapEvidenceExecutionPath,
} from './cloudflare-evidence-execution-path';

describe('evidence execution path mapping', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('maps journaled workspace paths into the private execution root', () => {
    vi.stubEnv('EVIDENCE_WORKSPACE_ROOT', '/workspace');
    vi.stubEnv('EVIDENCE_EXECUTION_ROOT', '/private/execution');
    expect(evidenceExecutionRoot()).toBe('/private/execution');
    expect(
      mapEvidenceExecutionPath('/workspace/apps/web/tools/cost/command.ts')
    ).toBe('/private/execution/apps/web/tools/cost/command.ts');
  });

  it('rejects a path outside the journal workspace', () => {
    vi.stubEnv('EVIDENCE_WORKSPACE_ROOT', '/workspace');
    vi.stubEnv('EVIDENCE_EXECUTION_ROOT', '/private/execution');
    expect(() => mapEvidenceExecutionPath('/other/command.ts')).toThrow(
      'outside the workspace'
    );
  });
});
