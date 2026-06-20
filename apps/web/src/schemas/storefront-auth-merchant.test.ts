import { describe, expect, it } from 'vitest';
import { storefrontAuthMerchantRpcRowSchema } from './storefront-auth-merchant';

describe('storefrontAuthMerchantRpcRowSchema', () => {
  it('parses a valid storefront auth merchant RPC row', () => {
    const parsed = storefrontAuthMerchantRpcRowSchema.safeParse({
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected schema parse to succeed');
    }

    expect(parsed.data).toEqual({
      business_name: 'Ogabassey',
      custom_domain: 'ogabassey.com',
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });
  });

  it('keeps null custom domains as null', () => {
    const parsed = storefrontAuthMerchantRpcRowSchema.safeParse({
      business_name: 'Ogabassey',
      custom_domain: null,
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });

    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      throw new Error('Expected schema parse to succeed');
    }

    expect(parsed.data?.custom_domain).toBeNull();
  });

  it('coerces missing and non-string custom domains to null', () => {
    const missingCustomDomain = storefrontAuthMerchantRpcRowSchema.safeParse({
      business_name: 'Ogabassey',
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });
    const numericCustomDomain = storefrontAuthMerchantRpcRowSchema.safeParse({
      business_name: 'Ogabassey',
      custom_domain: 123,
      id: 'merchant-1',
      is_published: true,
      slug: 'ogabassey',
    });

    expect(missingCustomDomain.success).toBe(true);
    if (!missingCustomDomain.success) {
      throw new Error('Expected missing custom domain parse to succeed');
    }

    expect(missingCustomDomain.data?.custom_domain).toBeNull();
    expect(numericCustomDomain.success).toBe(true);
    if (!numericCustomDomain.success) {
      throw new Error('Expected numeric custom domain parse to succeed');
    }

    expect(numericCustomDomain.data?.custom_domain).toBeNull();
  });

  it('rejects rows missing required merchant fields', () => {
    const parsed = storefrontAuthMerchantRpcRowSchema.safeParse({
      custom_domain: 'ogabassey.com',
      id: 'merchant-1',
      slug: 'ogabassey',
    });

    expect(parsed.success).toBe(false);
  });
});
