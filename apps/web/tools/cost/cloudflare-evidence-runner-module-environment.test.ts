import { describe, expect, it } from 'vitest';
import { evidenceRunnerModuleEnvironmentNames } from './cloudflare-evidence-runner-module-environment';

describe('evidenceRunnerModuleEnvironmentNames', () => {
  it('provides distinct environment variables for the recovery adapter', () => {
    const recovery = evidenceRunnerModuleEnvironmentNames('readRevocation');

    expect(recovery).toEqual({
      path: 'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE',
      sha256: 'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256',
    });
    expect(recovery).not.toEqual(
      evidenceRunnerModuleEnvironmentNames('measurement')
    );
  });
});
