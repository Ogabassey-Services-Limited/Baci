import { describe, expect, it } from 'vitest';
import {
  getFromName,
  mapOrderItemToEmailItem,
  normalizeHttpsUrl,
  PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN,
  resolveMerchantUrl,
  SUPABASE_ROW_NOT_FOUND_CODE,
} from '@/lib/payments/paid-order-email-utils';
import type { MerchantDetails } from '@/lib/payments/paid-order-side-effect-types';

const merchantDetails: MerchantDetails = {
  business_name: 'Ogabassey',
  cac_rc_number: 'RC123',
  email: 'merchant@example.com',
  email_sender_name: 'Bassey Store',
  slug: 'ogabassey',
  support_email: 'support@example.com',
  tax_identification_number: 'TIN123',
  website_url: null,
};

describe('paid-order email utilities', () => {
  it('normalizes HTTPS merchant URLs and rejects unsafe URLs', () => {
    expect(normalizeHttpsUrl(null)).toBeNull();
    expect(normalizeHttpsUrl('')).toBeNull();
    expect(normalizeHttpsUrl('store.example.com')).toBe(
      'https://store.example.com/'
    );
    expect(normalizeHttpsUrl('http://store.example.com')).toBe(
      'https://store.example.com/'
    );
    expect(normalizeHttpsUrl('HTTP://Store.Example.com/Path')).toBe(
      'https://store.example.com/Path'
    );
    expect(normalizeHttpsUrl('HTTPS://Store.Example.com/Path?q=One#Top')).toBe(
      'https://store.example.com/Path?q=One#Top'
    );
    expect(normalizeHttpsUrl('https://user:pass@store.example.com/path')).toBe(
      'https://store.example.com/path'
    );
    expect(normalizeHttpsUrl('javascript:alert(1)')).toBeNull();
    expect(
      normalizeHttpsUrl('data:text/html,<script>alert(1)</script>')
    ).toBeNull();
    expect(normalizeHttpsUrl('file:///etc/passwd')).toBeNull();
    expect(normalizeHttpsUrl('ftp://malicious.example')).toBeNull();
    expect(
      normalizeHttpsUrl(`store.example.com/${'a'.repeat(2050)}`)
    ).toBeNull();
  });

  it('resolves merchant URLs from website, slug, or the root domain', () => {
    expect(
      resolveMerchantUrl({ merchantDetails, rootDomain: 'root.test' })
    ).toBe('https://ogabassey.root.test');
    expect(
      resolveMerchantUrl({
        merchantDetails: {
          ...merchantDetails,
          website_url: 'shop.example.com',
        },
        rootDomain: 'root.test',
      })
    ).toBe('https://shop.example.com/');
    expect(
      resolveMerchantUrl({
        merchantDetails: {
          ...merchantDetails,
          website_url: 'http://shop.example.com/path',
        },
        rootDomain: 'root.test',
      })
    ).toBe('https://shop.example.com/path');
    expect(
      resolveMerchantUrl({
        merchantDetails: {
          ...merchantDetails,
          slug: 'bad slug!',
          website_url: null,
        },
        rootDomain: 'root.test',
      })
    ).toBe('https://root.test');
    expect(
      resolveMerchantUrl({
        merchantDetails,
        rootDomain: '',
      })
    ).toBe('https://ogabassey.usebaci.com');
    expect(
      resolveMerchantUrl({
        merchantDetails,
        rootDomain: null as unknown as string,
      })
    ).toBe('https://ogabassey.usebaci.com');
    expect(
      resolveMerchantUrl({
        merchantDetails,
        rootDomain: 'bad domain',
      })
    ).toBe('https://ogabassey.usebaci.com');
    expect(
      resolveMerchantUrl({
        merchantDetails: { ...merchantDetails, slug: null, website_url: null },
        rootDomain: 'root.test',
      })
    ).toBe('https://root.test');
  });

  it('derives email sender names from merchant preferences', () => {
    expect(getFromName(merchantDetails)).toBe('Bassey Store Orders');
    expect(
      getFromName({
        ...merchantDetails,
        email_sender_name: null,
      })
    ).toBe('Ogabassey Orders');
    expect(
      getFromName({
        ...merchantDetails,
        business_name: null,
        email_sender_name: null,
      })
    ).toBeUndefined();
  });

  it('maps order items into email template items', () => {
    expect(
      mapOrderItemToEmailItem({
        condition: 'open_box',
        name: 'iPhone',
        price: '20000',
        quantity: 2,
        variant_name: 'Black',
      } as Parameters<typeof mapOrderItemToEmailItem>[0])
    ).toEqual({
      name: 'iPhone (Open Box / Black)',
      price: 20_000,
      quantity: 2,
    });
    expect(
      mapOrderItemToEmailItem({
        condition: 'used',
        name: 'iPhone',
        price: '20000',
        quantity: 2,
        variant_name: 'Open Box / Black',
      } as Parameters<typeof mapOrderItemToEmailItem>[0])
    ).toEqual({
      name: 'iPhone (Used / Open Box / Black)',
      price: 20_000,
      quantity: 2,
    });
    expect(
      mapOrderItemToEmailItem({
        name: 'iPhone',
        price: '20000',
        quantity: 2,
        variant_name: null,
      })
    ).toEqual({ name: 'iPhone', price: 20_000, quantity: 2 });
    expect(
      mapOrderItemToEmailItem({
        name: '  ',
        price: undefined as never,
        quantity: null,
        variant_name: '  Black  ',
      })
    ).toEqual({ name: 'Product (Black)', price: 0, quantity: 1 });
    expect(() =>
      mapOrderItemToEmailItem({
        name: null,
        price: 'not-money',
        quantity: 1,
        variant_name: null,
      })
    ).toThrow('Invalid order item price');
  });

  it('names external provider constants used by the executor', () => {
    expect(PAID_ORDER_EMAIL_FALLBACK_ROOT_DOMAIN).toBe('usebaci.com');
    expect(SUPABASE_ROW_NOT_FOUND_CODE).toBe('PGRST116');
  });
});
