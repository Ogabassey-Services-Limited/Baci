import { describe, expect, it } from 'vitest';
import { selectPrivateEvidenceRunnerDescriptor } from './cloudflare-evidence-private-closure-runner';

const journal = {
  measurementRunnerModulePath: '/workspace/measurement.ts',
  measurementRunnerModuleSha256: 'a'.repeat(64),
  mutationRunnerModulePath: '/workspace/mutation.ts',
  mutationRunnerModuleSha256: 'b'.repeat(64),
  readRevocationRunnerModulePath: '/workspace/readback.ts',
  readRevocationRunnerModuleSha256: 'c'.repeat(64),
};

describe('selectPrivateEvidenceRunnerDescriptor', () => {
  it('selects journaled measurement and mutation modules', () => {
    expect(selectPrivateEvidenceRunnerDescriptor('measure', journal)).toEqual({
      name: 'EVIDENCE_MEASUREMENT_RUNNER_MODULE',
      sha256Name: 'EVIDENCE_MEASUREMENT_RUNNER_MODULE_SHA256',
      descriptor: {
        path: '/workspace/measurement.ts',
        sha256: 'a'.repeat(64),
      },
    });
    expect(selectPrivateEvidenceRunnerDescriptor('mutate', journal)).toEqual({
      name: 'EVIDENCE_MUTATION_RUNNER_MODULE',
      sha256Name: 'EVIDENCE_MUTATION_RUNNER_MODULE_SHA256',
      descriptor: {
        path: '/workspace/mutation.ts',
        sha256: 'b'.repeat(64),
      },
    });
  });

  it('selects the journaled readback module for receipt recovery', () => {
    expect(
      selectPrivateEvidenceRunnerDescriptor('record-read-revocation', journal)
    ).toEqual({
      name: 'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE',
      sha256Name: 'EVIDENCE_READ_TOKEN_REVOCATION_READBACK_MODULE_SHA256',
      descriptor: {
        path: '/workspace/readback.ts',
        sha256: 'c'.repeat(64),
      },
    });
  });

  it('rejects missing or malformed descriptors', () => {
    expect(() =>
      selectPrivateEvidenceRunnerDescriptor('measure', {
        ...journal,
        measurementRunnerModulePath: undefined,
      })
    ).toThrow('journal is missing');
    expect(() =>
      selectPrivateEvidenceRunnerDescriptor('record-read-revocation', {
        ...journal,
        readRevocationRunnerModulePath: undefined,
      })
    ).toThrow('journal is missing the read-token revocation module descriptor');
  });
});
