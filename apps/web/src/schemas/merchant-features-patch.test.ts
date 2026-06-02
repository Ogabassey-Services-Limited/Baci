import { describe, expect, it } from 'vitest';
import { merchantFeatureSettingsPatchSchema } from './merchant-features';

describe('merchantFeatureSettingsPatchSchema', () => {
  it('keeps sparse updates from materializing Klump defaults', () => {
    const result = merchantFeatureSettingsPatchSchema.parse({
      loyalty_enabled: true,
    });

    expect(result).toEqual({
      loyalty_enabled: true,
    });
  });

  it('accepts explicit Klump updates when provided', () => {
    const result = merchantFeatureSettingsPatchSchema.parse({
      klump_enabled: true,
      klump_min_amount: 2_500,
      klump_max_amount: 750_000,
    });

    expect(result).toEqual({
      klump_enabled: true,
      klump_min_amount: 2_500,
      klump_max_amount: 750_000,
    });
  });
});
