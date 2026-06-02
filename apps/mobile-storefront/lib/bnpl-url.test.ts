import { describe, expect, it } from '@jest/globals';
import {
  buildKlumpAuthorizationUrl,
  getAuthorizationSearchParams,
  isAllowedBnplPopupUrl,
  normalizeBNPLRouteParams,
} from '@/lib/bnpl-url';

describe('bnpl-url', () => {
  it('normalizes duplicated route params to their first value', () => {
    expect(
      normalizeBNPLRouteParams({
        gateway: ['klump', 'credit_direct'],
        orderId: 'order-123',
      })
    ).toEqual({
      gateway: 'klump',
      orderId: 'order-123',
    });
  });

  it('returns search params only for trusted authorization origins', () => {
    expect(
      getAuthorizationSearchParams(
        'https://usebaci.com/ogabassey/checkout/bnpl?reference=BAC-123',
        'https://usebaci.com'
      )?.get('reference')
    ).toBe('BAC-123');

    expect(
      getAuthorizationSearchParams(
        'https://evil.example/checkout/bnpl?reference=BAC-123',
        'https://usebaci.com'
      )
    ).toBeNull();
  });

  it('builds Klump URLs from explicit params when authorization URL is untrusted', () => {
    const url = new URL(
      buildKlumpAuthorizationUrl({
        authorizationUrl:
          'https://evil.example/checkout/bnpl?reference=BAD&trackingToken=bad-token',
        baseUrl: 'https://usebaci.com',
        customerEmail: 'customer@example.com',
        customerPhone: '+2348012345678',
        orderId: 'order-123',
        reference: 'BAC-123',
        slug: 'ogabassey',
        trackingToken: 'track-token-123',
      })
    );

    expect(url.origin).toBe('https://usebaci.com');
    expect(url.pathname).toBe('/ogabassey/checkout/bnpl');
    expect(url.searchParams.get('reference')).toBe('BAC-123');
    expect(url.searchParams.get('trackingToken')).toBe('track-token-123');
    expect(url.searchParams.get('email')).toBe('customer@example.com');
    expect(url.searchParams.get('customerPhone')).toBe('+2348012345678');
  });

  it('allows provider and Baci return popup URLs only', () => {
    expect(
      isAllowedBnplPopupUrl(
        'https://checkout.creditdirect.ng/bnpl/session-123',
        'https://usebaci.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://connect.mono.co/widget/session-123',
        'https://usebaci.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://ogabassey.usebaci.com/order-success',
        'https://usebaci.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl('https://evil.example/phish', 'https://usebaci.com')
    ).toBe(false);
  });

  it('allows only safe merchant custom-domain return popup URLs', () => {
    expect(
      isAllowedBnplPopupUrl(
        'https://merchant.example.com/order-success',
        'https://usebaci.com',
        'merchant.example.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://www.merchant.example.com/order-success',
        'https://usebaci.com',
        'merchant.example.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://checkout.merchant.example.com/order-success',
        'https://usebaci.com',
        'merchant.example.com'
      )
    ).toBe(false);
    expect(
      isAllowedBnplPopupUrl(
        'https://merchant.example.com/order-success',
        'https://usebaci.com',
        'merchant',
        'merchant.example.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://attackmerchant.example.com/order-success',
        'https://usebaci.com',
        'merchant.example.com'
      )
    ).toBe(false);
    expect(
      isAllowedBnplPopupUrl(
        'https://merchant.example.com.evil.test/order-success',
        'https://usebaci.com',
        'merchant.example.com'
      )
    ).toBe(false);
    expect(
      isAllowedBnplPopupUrl(
        'http://merchant.example.com/order-success',
        'https://usebaci.com',
        'merchant.example.com'
      )
    ).toBe(false);
    expect(
      isAllowedBnplPopupUrl(
        'https://ogabassey.com/order-success',
        'https://usebaci.com',
        'ogabassey',
        'ogabassey.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://www.ogabassey.com/order-success',
        'https://usebaci.com',
        'ogabassey',
        'ogabassey.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'http://ogabassey.com/order-success',
        'https://usebaci.com',
        'ogabassey',
        'ogabassey.com'
      )
    ).toBe(false);
    expect(
      isAllowedBnplPopupUrl(
        'https://ogabassey.com/order-success',
        'https://usebaci.com',
        '',
        'ogabassey.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://ogabassey.com/order-success',
        'https://usebaci.com',
        'ogabassey$',
        'ogabassey.com'
      )
    ).toBe(true);
    expect(
      isAllowedBnplPopupUrl(
        'https://ogabassey.com/order-success',
        'https://usebaci.com',
        'ogabassey'
      )
    ).toBe(false);
    expect(
      isAllowedBnplPopupUrl(
        'https://evil.com/order-success',
        'https://usebaci.com',
        'com',
        'ogabassey.com'
      )
    ).toBe(false);
  });
});
