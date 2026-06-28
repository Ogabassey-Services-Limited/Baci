import { describe, expect, it } from 'vitest';
import { shouldDeferMobileUpdatePrompt } from './mobile-update-route-safety';

describe('shouldDeferMobileUpdatePrompt', () => {
  it.each([
    ['/'],
    ['/complete-profile'],
    ['/domains/buy'],
    ['/domains/buy/review'],
    ['/forgot-password'],
    ['/login'],
    ['/onboarding'],
    ['/register'],
    ['/scan'],
    ['/scan/imei'],
    ['/subscribe'],
    ['/verify'],
  ])('defers mobile update prompts on sensitive route %s', (pathname) => {
    expect(shouldDeferMobileUpdatePrompt(pathname)).toBe(true);
  });

  it.each([
    ['/(auth)'],
    ['/(auth)/login'],
    ['/(admin)'],
    ['/(admin)/(tabs)'],
    ['/(admin)/orders'],
    ['/(admin)/scan'],
    ['/orders'],
    ['/negotiations'],
    ['/scanner'],
    [null],
    [undefined],
  ])('allows mobile update prompts on safe route %s', (pathname) => {
    expect(shouldDeferMobileUpdatePrompt(pathname)).toBe(false);
  });
});
