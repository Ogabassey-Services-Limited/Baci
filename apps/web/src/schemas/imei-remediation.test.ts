import { describe, expect, it } from 'vitest';
import {
  imeiRemediationEligibilitySchema,
  imeiRemediationOrderSchema,
} from './imei-remediation';

describe('IMEI remediation schemas', () => {
  it('accepts an eligibility request with a UUID lookup and device identifier', () => {
    expect(
      imeiRemediationEligibilitySchema.safeParse({
        identifier: '490154203237518',
        lookupId: '11111111-1111-4111-8111-111111111111',
      }).success
    ).toBe(true);
  });

  it('accepts only supported wallet currencies for a confirmed offer', () => {
    const input = {
      identifier: '490154203237518',
      orderId: '11111111-1111-4111-8111-111111111111',
      paymentCurrency: 'USDT',
      productId: '22222222-2222-4222-8222-222222222222',
    };
    expect(imeiRemediationOrderSchema.safeParse(input).success).toBe(true);
    expect(
      imeiRemediationOrderSchema.safeParse({
        ...input,
        paymentCurrency: 'USD',
      }).success
    ).toBe(false);
  });
});
