import { describe, expect, it } from 'vitest';
import { StorefrontPublicPoliciesSchema } from './public-projection-policies-schema';

describe('StorefrontPublicPoliciesSchema', () => {
  it('accepts public policy copy and release-safe links', () => {
    const policies = {
      privacy: '<p>Private by design. <a href="/contact">Contact us</a>.</p>',
    };
    expect(StorefrontPublicPoliciesSchema.parse(policies)).toEqual(policies);
  });

  it('rejects query-bearing links in policy bodies', () => {
    expect(
      StorefrontPublicPoliciesSchema.safeParse({
        privacy:
          '<a href="https://example.test/export?token=secret">Download</a>',
      }).success
    ).toBe(false);
  });
});
