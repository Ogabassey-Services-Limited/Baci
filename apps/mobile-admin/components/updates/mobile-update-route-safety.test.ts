import { describe, expect, it } from 'vitest';
import { shouldDeferMobileUpdatePrompt } from './mobile-update-route-safety';

describe('shouldDeferMobileUpdatePrompt', () => {
  it.each([
    ['/(auth)'],
    ['/(auth)/login'],
    ['/(admin)/scan'],
    ['/(admin)/scan/imei'],
  ])('defers mobile update prompts on sensitive route %s', (pathname) => {
    expect(shouldDeferMobileUpdatePrompt(pathname)).toBe(true);
  });

  it.each([
    ['/'],
    ['/(admin)'],
    ['/(admin)/(tabs)'],
    ['/(admin)/orders'],
    ['/(admin)/negotiations'],
    ['/(admin)/scanner'],
    [null],
    [undefined],
  ])('allows mobile update prompts on safe route %s', (pathname) => {
    expect(shouldDeferMobileUpdatePrompt(pathname)).toBe(false);
  });
});
