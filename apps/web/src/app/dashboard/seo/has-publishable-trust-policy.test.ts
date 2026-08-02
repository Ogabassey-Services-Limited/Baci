import { describe, expect, it } from 'vitest';
import { hasPublishableTrustPolicy } from './has-publishable-trust-policy';

describe('hasPublishableTrustPolicy', () => {
  it('does not treat an empty trust profile as a published policy', () => {
    expect(hasPublishableTrustPolicy({})).toBe(false);
  });

  it('recognizes a meaningful return policy', () => {
    expect(
      hasPublishableTrustPolicy({
        returnPolicy: {
          summary: 'Returns accepted within 14 days.',
          localRoute: '/returns',
        },
      })
    ).toBe(true);
  });
});
