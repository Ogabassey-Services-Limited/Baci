import { describe, expect, it } from 'vitest';
import { proof } from './cloudflare-evidence-qualification-traffic.test-fixtures';
import { ZeroWeightProofSchema } from './cloudflare-evidence-zero-weight-proof-schema';

describe('Cloudflare zero-weight proof schema', () => {
  it('accepts only the complete strict provider proof', () => {
    expect(ZeroWeightProofSchema.safeParse(proof).success).toBe(true);
    expect(
      ZeroWeightProofSchema.safeParse({ ...proof, unknown: true }).success
    ).toBe(false);
    expect(
      ZeroWeightProofSchema.safeParse({
        ...proof,
        ordinaryTraffic: { ...proof.ordinaryTraffic, requestCount: 0 },
      }).success
    ).toBe(false);
  });
});
