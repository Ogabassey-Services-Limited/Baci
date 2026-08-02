import { describe, expect, it } from 'vitest';
import { postHogMobileOnboardingHealthResponseSchema } from './mobile-onboarding-contract-health';

describe('postHogMobileOnboardingHealthResponseSchema', () => {
  it('accepts only bounded contract and canary rows and coerces counts', () => {
    const result = postHogMobileOnboardingHealthResponseSchema.parse({
      columns: ['day', 'event', 'contract', 'total'],
      results: [
        [
          '2026-07-27',
          'mobile_onboarding_contract_invoked',
          'v2_authenticated',
          '4',
        ],
        [
          '2026-07-27',
          'mobile_onboarding_contract_telemetry_canary',
          'canary',
          1,
        ],
      ],
    });

    expect(result.results[0]?.[3]).toBe(4);
    expect(result.results[1]?.[3]).toBe(1);
  });

  it.each([
    ['2026-07-27', 'mobile_onboarding_contract_invoked', 'unknown', 1],
    [
      '2026-07-27',
      'mobile_onboarding_contract_telemetry_canary',
      'v1_legacy',
      1,
    ],
    ['not-a-date', 'mobile_onboarding_contract_invoked', 'v1_legacy', 1],
    ['2026-02-31', 'mobile_onboarding_contract_invoked', 'v1_legacy', 1],
    ['2026-07-27', 'mobile_onboarding_contract_invoked', 'v1_legacy', -1],
  ])('rejects malformed row %j', (...row) => {
    expect(
      postHogMobileOnboardingHealthResponseSchema.safeParse({
        results: [row],
      }).success
    ).toBe(false);
  });
});
