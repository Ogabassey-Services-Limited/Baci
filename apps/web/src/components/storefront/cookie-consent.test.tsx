import { act, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CookieConsent, useCookieConsent } from './cookie-consent';

// Mock dependencies required by module imports for export tests
vi.mock('@/hooks/use-merchant', () => ({
  useMerchantSafe: () => ({ basePath: '' }),
}));

vi.mock('@/lib/consent-mode', () => ({
  updateConsentMode: vi.fn(),
}));

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...rest
  }: {
    children: React.ReactNode;
    href: string;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe('CookieConsent', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  it('exports CookieConsent component', () => {
    expect(CookieConsent).toBeDefined();
    expect(typeof CookieConsent).toBe('function');
  });

  it('exports useCookieConsent hook', () => {
    expect(useCookieConsent).toBeDefined();
    expect(typeof useCookieConsent).toBe('function');
  });

  it('links the banner policy CTA to the canonical privacy route', () => {
    render(<CookieConsent />);

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(
      screen.getByRole('link', { name: /read our policy/i })
    ).toHaveAttribute('href', '/privacy');
  });
});
