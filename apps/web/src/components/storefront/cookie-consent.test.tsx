import { describe, expect, it } from 'vitest';
import { CookieConsent, useCookieConsent } from './cookie-consent';

describe('CookieConsent', () => {
  it('exports CookieConsent component', () => {
    expect(CookieConsent).toBeDefined();
    expect(typeof CookieConsent).toBe('function');
  });

  it('exports useCookieConsent hook', () => {
    expect(useCookieConsent).toBeDefined();
    expect(typeof useCookieConsent).toBe('function');
  });
});
