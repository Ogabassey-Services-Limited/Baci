import { describe, expect, it, vi } from 'vitest';
import { CookieConsent, useCookieConsent } from './cookie-consent';

// Mock dependencies to allow rendering tests
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({ basePath: '' }),
}));

vi.mock('@/lib/consent-mode', () => ({
  updateConsentMode: vi.fn(),
}));

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
