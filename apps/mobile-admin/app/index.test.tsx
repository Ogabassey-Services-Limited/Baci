import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useOnboarding: vi.fn(),
  useMerchant: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) =>
    `redirect:${href}`,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: mocks.useAuth,
}));

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: mocks.useOnboarding,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

import Index from './index';

describe('app index redirect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useAuth.mockReturnValue({
      isAuthenticated: true,
      isLoading: false,
    });
    mocks.useOnboarding.mockReturnValue({
      hasSeenOnboarding: true,
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('routes incomplete merchants to complete-profile', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { business_name: null, slug: null },
      isLoading: false,
    });

    render(<Index />);

    expect(screen.getByText('redirect:/(auth)/complete-profile')).toBeTruthy();
  });

  it('routes complete merchants to the admin tabs', () => {
    mocks.useMerchant.mockReturnValue({
      merchant: { business_name: 'Test Store', slug: 'test-store' },
      isLoading: false,
    });

    render(<Index />);

    expect(screen.getByText('redirect:/(admin)/(tabs)')).toBeTruthy();
  });
});
