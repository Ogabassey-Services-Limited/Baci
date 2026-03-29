import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isLoading: false,
  },
  onboarding: {
    hasSeenOnboarding: true,
    isLoading: false,
  },
  merchant: {
    merchant: null as { id: string } | null,
    error: null as Error | null,
    isLoading: false,
  },
  segments: ['(auth)', 'login'] as string[],
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('div', null, 'loading'),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', async () => {
  const React = await import('react');

  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'auth-stack' }, children);
  Stack.Screen = () => null;

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement('div', { 'data-testid': 'redirect' }, href),
    Stack,
    useSegments: () => mocks.segments,
  };
});

vi.mock('@/context/OnboardingContext', () => ({
  useOnboarding: () => mocks.onboarding,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => mocks.merchant,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000000',
      primary: '#ffffff',
    },
  }),
}));

import AuthLayout from '../../app/(auth)/_layout';

describe('AuthLayout', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
    mocks.onboarding.hasSeenOnboarding = true;
    mocks.onboarding.isLoading = false;
    mocks.merchant.merchant = null;
    mocks.merchant.error = null;
    mocks.merchant.isLoading = false;
    mocks.segments = ['(auth)', 'login'];
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects authenticated users without a valid merchant to complete-profile', () => {
    mocks.auth.isAuthenticated = true;

    render(<AuthLayout />);

    expect(screen.getByTestId('redirect').textContent).toBe(
      '/(auth)/complete-profile'
    );
  });

  it('redirects authenticated users with a merchant to the admin tabs', () => {
    mocks.auth.isAuthenticated = true;
    mocks.merchant.merchant = { id: 'merchant-1' };

    render(<AuthLayout />);

    expect(screen.getByTestId('redirect').textContent).toBe('/(admin)/(tabs)');
  });

  it('does not redirect away from the complete-profile screen', () => {
    mocks.auth.isAuthenticated = true;
    mocks.segments = ['(auth)', 'complete-profile'];

    render(<AuthLayout />);

    expect(screen.getByTestId('auth-stack')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('shows an error state instead of redirecting when merchant lookup fails', () => {
    mocks.auth.isAuthenticated = true;
    mocks.merchant.error = new Error('merchant fetch failed');

    render(<AuthLayout />);

    expect(
      screen.getByText('Unable to load your merchant profile right now.')
    ).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });
});
