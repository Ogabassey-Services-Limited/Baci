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

  it('falls back to the default checkout path when the input is whitespace only', () => {
    expect(buildCheckoutIdentityRoutes('   ')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });

  it('preserves hash fragments and encodes them for signup redirects', () => {
    expect(buildCheckoutIdentityRoutes('/checkout#section')).toEqual({
      checkoutUrl: '/checkout#section',
      signupUrl: '/signup?redirect=%2Fcheckout%23section',
    });
  });

  it('falls back to the default checkout path for unsafe absolute URLs', () => {
    expect(buildCheckoutIdentityRoutes('//example.org/checkout')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });

  it('falls back to the default checkout path for absolute URLs with protocols', () => {
    expect(buildCheckoutIdentityRoutes('https://example.com/checkout')).toEqual(
      {
        checkoutUrl: '/checkout',
        signupUrl: '/signup?redirect=%2Fcheckout',
      }
    );
  });

  it('falls back to the default checkout path for http URLs', () => {
    expect(buildCheckoutIdentityRoutes('http://example.net/steal')).toEqual({
      checkoutUrl: '/checkout',
      signupUrl: '/signup?redirect=%2Fcheckout',
    });
  });
});
