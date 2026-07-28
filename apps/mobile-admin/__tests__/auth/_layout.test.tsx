import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isLoading: false,
    user: null as { id: string } | null,
  },
  onboarding: {
    hasSeenOnboarding: true,
    isLoading: false,
  },
  merchant: {
    merchant: null as { id: string } | null,
    error: null as Error | null,
    isLoading: false,
    refetch: vi.fn(),
    resolvedForUserId: null as string | null,
  },
  segments: ['(auth)', 'login'] as string[],
  pendingStaffInviteToken: null as string | null,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    ActivityIndicator: () => React.createElement('div', null, 'loading'),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) => React.createElement('button', { onClick: onPress }, children),
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

vi.mock('@/lib/staff-invite-pending', () => ({
  buildStaffInviteRoute: (token: string) => `/invite/${token}`,
  getPendingStaffInviteToken: () => mocks.pendingStaffInviteToken,
}));

import AuthLayout from '../../app/(auth)/_layout';

describe('AuthLayout', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
    mocks.auth.user = null;
    mocks.onboarding.hasSeenOnboarding = true;
    mocks.onboarding.isLoading = false;
    mocks.merchant.merchant = null;
    mocks.merchant.error = null;
    mocks.merchant.isLoading = false;
    mocks.merchant.refetch.mockReset();
    mocks.merchant.resolvedForUserId = null;
    mocks.pendingStaffInviteToken = null;
    mocks.segments = ['(auth)', 'login'];
  });

  afterEach(() => {
    cleanup();
  });

  it('redirects authenticated users without a valid merchant to complete-profile', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.resolvedForUserId = 'user-1';

    render(<AuthLayout />);

    expect(screen.getByTestId('redirect').textContent).toBe(
      '/(auth)/complete-profile'
    );
  });

  it('redirects authenticated users with a merchant to the admin tabs', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.merchant = { id: 'merchant-1' };
    mocks.merchant.resolvedForUserId = 'user-1';

    render(<AuthLayout />);

    expect(screen.getByTestId('redirect').textContent).toBe('/(admin)/(tabs)');
  });

  it('redirects authenticated users to a pending staff invite before merchant routing', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.resolvedForUserId = 'user-1';
    mocks.merchant.error = new Error('merchant fetch failed');
    mocks.pendingStaffInviteToken = 'token-123';

    render(<AuthLayout />);

    expect(screen.getByTestId('redirect').textContent).toBe(
      '/invite/token-123'
    );
  });

  it('does not redirect away from the complete-profile screen', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.segments = ['(auth)', 'complete-profile'];

    render(<AuthLayout />);

    expect(screen.getByTestId('auth-stack')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('shows an error state instead of redirecting when merchant lookup fails', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.error = new Error('merchant fetch failed');

    render(<AuthLayout />);

    expect(
      screen.getByText('Unable to load your merchant profile right now.')
    ).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('keeps signed-out users in the auth stack', () => {
    render(<AuthLayout />);

    expect(screen.getByTestId('auth-stack')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('does not leave verification while the authenticated signup flow finishes', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.segments = ['(auth)', 'verify'];

    render(<AuthLayout />);

    expect(screen.getByTestId('auth-stack')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('does not route stale merchant data resolved for a previous user to admin', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'current-user' };
    mocks.merchant.merchant = { id: 'prior-merchant' };
    mocks.merchant.resolvedForUserId = 'prior-user';

    render(<AuthLayout />);

    expect(screen.getByText('loading')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('lets the user retry a failed current-user merchant lookup', () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.error = new Error('merchant fetch failed');

    render(<AuthLayout />);

    screen.getByRole('button', { name: 'Try again' }).click();

    expect(mocks.merchant.refetch).toHaveBeenCalledOnce();
  });
});
