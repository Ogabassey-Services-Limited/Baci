import { describe, expect, it } from 'vitest';
import { cloudflareEvidencePrepare } from './cloudflare-evidence-prepare';

const input = {
  runId: 'run-123',
  approvalId: 'approval-123',
  policyId: 'policy-123',
  toolingMergeSha: '1'.repeat(40),
  writeTokenId: 'write-token-id',
  readTokenId: 'read-token-id',
  accountId: 'account-id',
  zoneId: 'zone-id',
  plannedResources: ['baci-evidence-run-123'],
  preInventorySha256: 'a'.repeat(64),
  expectedProbeCount: 2,
};

describe('cloudflareEvidencePrepare', () => {
  it('round-trips the bounded credentialless prepare options', () => {
    expect(
      cloudflareEvidencePrepare.parseArguments(
        cloudflareEvidencePrepare.argumentsFor(input)
      )
    ).toEqual(input);
  });

  it('rejects unknown options, invalid tooling SHAs, and unrelated resources', () => {
    const valid = cloudflareEvidencePrepare.argumentsFor(input);
    for (const args of [
      [...valid, '--token', 'secret'],
      valid.map((value) => (value === input.toolingMergeSha ? 'bad' : value)),
      valid.map((value) =>
        value === input.plannedResources[0] ? 'foreign-resource' : value
      ),
    ])
      expect(() => cloudflareEvidencePrepare.parseArguments(args)).toThrow();
  });
});
