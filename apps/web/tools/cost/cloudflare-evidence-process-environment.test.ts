import { describe, expect, it } from 'vitest';
import { prepareEvidenceProcessEnvironment } from './cloudflare-evidence-process-environment';

const validEnvironment = () => ({
  PATH: '/bin',
  SECRET: 'must-not-forward',
  EVIDENCE_APPROVAL_ARTIFACT: '/private/approval.json',
  EVIDENCE_POLICY_ARTIFACT: '/private/policy.json',
  EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
    '/private/protected-merge-identity.json',
  EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE: '/private/authority.ts',
  EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE_SHA256: 'a'.repeat(64),
  EVIDENCE_MUTATION_RUNNER_MODULE: '/workspace/mutation.ts',
  EVIDENCE_MUTATION_RUNNER_MODULE_SHA256: 'b'.repeat(64),
  EVIDENCE_MEASUREMENT_RUNNER_MODULE: '/workspace/measurement.ts',
  EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256: 'c'.repeat(64),
  EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: '/workspace/readback.ts',
  EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: 'd'.repeat(64),
});

describe('prepareEvidenceProcessEnvironment', () => {
  it('forwards only the prepare authority and reviewed module descriptors', () => {
    const environment = prepareEvidenceProcessEnvironment(validEnvironment());

    expect(environment).toEqual({
      PATH: '/bin',
      EVIDENCE_APPROVAL_ARTIFACT: '/private/approval.json',
      EVIDENCE_POLICY_ARTIFACT: '/private/policy.json',
      EVIDENCE_PROTECTED_MERGE_IDENTITY_ARTIFACT:
        '/private/protected-merge-identity.json',
      EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE: '/private/authority.ts',
      EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE_SHA256: 'a'.repeat(64),
      EVIDENCE_MUTATION_RUNNER_MODULE: '/workspace/mutation.ts',
      EVIDENCE_MUTATION_RUNNER_MODULE_SHA256: 'b'.repeat(64),
      EVIDENCE_MEASUREMENT_RUNNER_MODULE: '/workspace/measurement.ts',
      EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256: 'c'.repeat(64),
      EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE: '/workspace/readback.ts',
      EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256: 'd'.repeat(64),
    });
  });

  it('fails closed when the authenticated authority descriptor is missing', () => {
    const environment = {
      ...validEnvironment(),
      EVIDENCE_PROTECTED_MERGE_AUTHORITY_MODULE: undefined,
    };

    expect(() => prepareEvidenceProcessEnvironment(environment)).toThrow(
      'authenticated protected merge authority module descriptor is required'
    );
  });
});
