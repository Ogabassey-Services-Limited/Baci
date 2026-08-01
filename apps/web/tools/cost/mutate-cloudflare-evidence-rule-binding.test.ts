import { describe, expect, it } from 'vitest';
import {
  calculateEvidenceTemporaryRuleCanonicalSha256,
  REVIEWED_TEMPORARY_RULE_BINDING,
  verifyTemporaryRule,
} from './mutate-cloudflare-evidence-rule-binding';

describe('mutate-cloudflare-evidence-rule-binding', () => {
  it('recomputes and accepts the reviewed complete binding', () => {
    expect(
      calculateEvidenceTemporaryRuleCanonicalSha256(
        REVIEWED_TEMPORARY_RULE_BINDING
      )
    ).toBe(REVIEWED_TEMPORARY_RULE_BINDING.canonicalSha256);
    expect(verifyTemporaryRule(REVIEWED_TEMPORARY_RULE_BINDING)).toBe(true);
  });

  it('rejects a provider readback with a changed method', () => {
    expect(() =>
      verifyTemporaryRule({
        ...REVIEWED_TEMPORARY_RULE_BINDING,
        methods: ['GET'],
        canonicalSha256: undefined,
      })
    ).toThrow('temporary rule fields do not match');
  });

  it('rejects an ID-only readback without an independently bound hash', () => {
    expect(() =>
      verifyTemporaryRule({ id: REVIEWED_TEMPORARY_RULE_BINDING.id })
    ).toThrow('missing its binding');
  });
});
