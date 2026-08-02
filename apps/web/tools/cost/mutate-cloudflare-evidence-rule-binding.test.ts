import { describe, expect, it } from 'vitest';
import {
  calculateEvidenceTemporaryRuleCanonicalSha256,
  createReviewedTemporaryRuleBinding,
  EVIDENCE_RUN_NONCE_PATTERN,
  verifyTemporaryRule,
} from './mutate-cloudflare-evidence-rule-binding';

const runId = '0123456789abcdef0123456789abcdef';
const binding = createReviewedTemporaryRuleBinding(runId);

describe('mutate-cloudflare-evidence-rule-binding', () => {
  it('recomputes and accepts the reviewed complete binding', () => {
    expect(calculateEvidenceTemporaryRuleCanonicalSha256(binding)).toBe(
      binding.canonicalSha256
    );
    expect(verifyTemporaryRule(binding, binding)).toBe(true);
  });

  it('rejects a provider readback with a changed method', () => {
    expect(() =>
      verifyTemporaryRule(
        {
          ...binding,
          methods: ['GET'],
          canonicalSha256: undefined,
        },
        binding
      )
    ).toThrow('temporary rule fields do not match');
  });

  it('scopes the temporary block to the exact probe and run headers', () => {
    expect(binding.expression).toBe(
      `http.host eq "edge-evidence.ogabassey.com" and http.request.headers["x-baci-evidence-probe"][0] eq "1" and http.request.headers["x-baci-evidence-run"][0] eq "${runId}"`
    );
    expect(() =>
      verifyTemporaryRule(
        {
          ...binding,
          expression: 'http.host eq "edge-evidence.ogabassey.com"',
          canonicalSha256: undefined,
        },
        binding
      )
    ).toThrow('temporary rule fields do not match');
  });

  it('requires a lowercase hexadecimal run nonce', () => {
    expect(EVIDENCE_RUN_NONCE_PATTERN.test(runId)).toBe(true);
    expect(() => createReviewedTemporaryRuleBinding('z'.repeat(32))).toThrow(
      'run nonce'
    );
  });

  it('rejects an ID-only readback without an independently bound hash', () => {
    expect(() => verifyTemporaryRule({ id: binding.id }, binding)).toThrow(
      'missing its binding'
    );
  });
});
