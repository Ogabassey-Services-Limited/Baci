import { describe, expect, it } from 'vitest';
import { buildCheckoutIdentityRoutes } from '@/components/storefront/checkout-route';

describe('buildCheckoutIdentityRoutes', () => {
  it('preserves valid checkout paths and encodes them for signup redirects', () => {
    expect(buildCheckoutIdentityRoutes('/store/checkout?coupon=VIP')).toEqual({
      checkoutUrl: '/store/checkout?coupon=VIP',
      signupUrl: '/signup?redirect=%2Fstore%2Fcheckout%3Fcoupon%3DVIP',
    });
  });

  it('normalizes missing leading slashes', () => {
    expect(buildCheckoutIdentityRoutes('store/checkout')).toEqual({
      checkoutUrl: '/store/checkout',
      signupUrl: '/signup?redirect=%2Fstore%2Fcheckout',
    });
  });

  it('falls back to the default checkout path when the input is empty', () => {
    expect(buildCheckoutIdentityRoutes('')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });

  it('falls back to the default checkout path for protocol-relative URLs', () => {
    expect(buildCheckoutIdentityRoutes('//evil.com/checkout')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });

  it('preserves hash fragments in the checkout URL and encodes them for signup redirects', () => {
    expect(buildCheckoutIdentityRoutes('/checkout#step2')).toEqual({
      checkoutUrl: '/checkout#step2',
      signupUrl: '/signup?redirect=%2Fcheckout%23step2',
    });
  });

  it('falls back to the default checkout path for absolute URLs with protocols', () => {
    expect(buildCheckoutIdentityRoutes('https://evil.com/checkout')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });

  it('falls back to the default checkout path for http URLs', () => {
    expect(buildCheckoutIdentityRoutes('http://evil.com/steal')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });
});
