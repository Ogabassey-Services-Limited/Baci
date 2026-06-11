import { describe, expect, it } from 'vitest';
import { OGABASSEY_DOMAIN, OGABASSEY_MERCHANT_ID } from '@/config/ogabassey';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getKnownOgaBasseyMerchantId } from './ogabassey-route-identity';

describe('getKnownOgaBasseyMerchantId', () => {
  it('recognizes the canonical OgaBassey template slug', () => {
    expect(getKnownOgaBasseyMerchantId(OGABASSEY_TEMPLATE_ID)).toBe(
      OGABASSEY_MERCHANT_ID
    );
  });

  it('recognizes the OgaBassey template slug case-insensitively', () => {
    expect(
      getKnownOgaBasseyMerchantId(` ${OGABASSEY_TEMPLATE_ID.toUpperCase()} `)
    ).toBe(OGABASSEY_MERCHANT_ID);
  });

  it('recognizes the OgaBassey custom domain case-insensitively', () => {
    expect(
      getKnownOgaBasseyMerchantId(` ${OGABASSEY_DOMAIN.toUpperCase()} `)
    ).toBe(OGABASSEY_MERCHANT_ID);
  });

  it('does not classify other storefront identifiers as OgaBassey', () => {
    expect(getKnownOgaBasseyMerchantId('another-merchant')).toBeNull();
  });

  it('returns null for empty or whitespace-only input', () => {
    expect(getKnownOgaBasseyMerchantId('')).toBeNull();
    expect(getKnownOgaBasseyMerchantId('   ')).toBeNull();
  });
});
