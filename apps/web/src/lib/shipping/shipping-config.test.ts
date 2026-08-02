import { describe, expect, it } from 'vitest';
import { mapToDeliveryTier, PROVIDER_CONFIGS } from './shipping-config';

describe('shipping configuration', () => {
  it('keeps GIGL international support and delivery-tier mapping explicit', () => {
    expect(PROVIDER_CONFIGS.GIGL.supportsInternational).toBe(true);
    expect(mapToDeliveryTier('GoFaster', 3)).toBe('express');
    expect(mapToDeliveryTier('GoStandard', 3)).toBe('standard');
  });
});
