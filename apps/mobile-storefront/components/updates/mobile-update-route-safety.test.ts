import { describe, expect, it } from '@jest/globals';
import { shouldDeferMobileUpdatePrompt } from './mobile-update-route-safety';

describe('shouldDeferMobileUpdatePrompt', () => {
  it.each([
    ['/checkout'],
    ['/checkout/address'],
    ['/payment-gateway'],
    ['/payment-gateway/card'],
    ['/bank-transfer'],
    ['/crypto-payment'],
    ['/bnpl-checkout'],
    ['/auth/login'],
    ['/utilities/airtime'],
    ['/utilities/history'],
  ])('defers mobile update prompts on sensitive route %s', (pathname) => {
    expect(shouldDeferMobileUpdatePrompt(pathname)).toBe(true);
  });

  it.each([
    ['/'],
    ['/(tabs)'],
    ['/product/iphone-17'],
    ['/category/smartphones'],
    ['/cart'],
    [null],
    [undefined],
  ])('allows mobile update prompts on safe route %s', (pathname) => {
    expect(shouldDeferMobileUpdatePrompt(pathname)).toBe(false);
  });
});
