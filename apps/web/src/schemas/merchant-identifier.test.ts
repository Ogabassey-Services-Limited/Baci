import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  optionalMerchantId,
  optionalNonEmptyString,
  optionalUuid,
  requireMerchantIdentifier,
  requireWalletFundingMerchantIdentifier,
} from '@/schemas/merchant-identifier';

describe('merchant identifier schema helpers', () => {
  it('trims optional non-empty strings', () => {
    expect(optionalNonEmptyString.parse(' ogabassey ')).toBe('ogabassey');
    expect(optionalNonEmptyString.parse('   ')).toBeUndefined();
  });

  it('rejects invalid optional UUIDs', () => {
    expect(optionalUuid.safeParse('not-a-uuid').success).toBe(false);
  });

  it('parses optional merchant ids', () => {
    expect(
      optionalMerchantId.parse('00000000-0000-4000-8000-000000000001')
    ).toBe('00000000-0000-4000-8000-000000000001');
  });

  it('requires at least one merchant identifier', () => {
    const schema = z
      .object({
        merchantId: optionalMerchantId,
        merchantSlug: optionalNonEmptyString,
      })
      .superRefine(requireMerchantIdentifier);

    expect(schema.safeParse({ merchantSlug: 'ogabassey' }).success).toBe(true);
    expect(
      schema.safeParse({
        merchantId: '00000000-0000-4000-8000-000000000001',
      }).success
    ).toBe(true);
    expect(
      schema.safeParse({
        merchantId: '00000000-0000-4000-8000-000000000001',
        merchantSlug: 'ogabassey',
      }).success
    ).toBe(true);
    expect(schema.safeParse({}).success).toBe(false);
  });

  it('uses wallet funding copy for wallet-specific refinement', () => {
    const schema = z
      .object({
        merchantId: optionalMerchantId,
        merchantSlug: optionalNonEmptyString,
      })
      .superRefine(requireWalletFundingMerchantIdentifier);

    expect(schema.safeParse({ merchantSlug: 'ogabassey' }).success).toBe(true);

    const result = schema.safeParse({});

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        'merchantSlug or merchantId is required'
      );
    }
  });
});
