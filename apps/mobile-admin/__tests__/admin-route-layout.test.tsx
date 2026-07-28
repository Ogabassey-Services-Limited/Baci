import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1' } as { id: string } | null,
  },
  merchant: {
    merchant: {
      id: 'merchant-1',
      is_published: true,
      plan_tier: 'business',
    } as {
      id: string;
      is_published: boolean | null;
      plan_tier: string | null;
    } | null,
  },
  push: {
    isLoading: false,
    isRegistered: true,
    registerPush: vi.fn().mockResolvedValue(undefined),
  },
  analyticsSync: {
    useAdminAnalyticsSync: vi.fn(),
  },
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () => React.createElement('div', null, 'loading'),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('expo-router', async () => {
  const React = await import('react');

  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(
      'div',
      { 'aria-label': 'admin stack', role: 'main' },
      children
    );
  Stack.Screen = () => null;

  return {
    Redirect: ({ href }: { href: string }) =>
      React.createElement('div', { 'data-testid': 'redirect' }, href),
    Stack,
  };
});

vi.mock('@/components/ui/ErrorBoundary', () => ({
  ErrorBoundary: ({ children }: { children?: React.ReactNode }) => children,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => mocks.merchant,
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => mocks.push,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#000000',
      primary: '#ffffff',
      text: '#ffffff',
    },
  }),
}));

vi.mock('@/hooks/useAdminAnalyticsSync', () => ({
  useAdminAnalyticsSync: mocks.analyticsSync.useAdminAnalyticsSync,
}));

import AdminLayout from '@/app/(admin)/_layout';

describe('AdminLayout analytics instrumentation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.merchant = {
      id: 'merchant-1',
      is_published: true,
      plan_tier: 'business',
    };
    mocks.push.isRegistered = true;
    mocks.push.isLoading = false;
  });

  it('delegates admin analytics identity sync to the analytics hook', async () => {
    render(<AdminLayout />);

    await waitFor(() => {
      expect(screen.getByRole('main', { name: 'admin stack' })).toBeTruthy();
    });

    expect(mocks.analyticsSync.useAdminAnalyticsSync).toHaveBeenCalledWith(
      mocks.auth.user,
      mocks.merchant.merchant
    );
  });

  it('passes missing user state to the analytics sync hook', async () => {
    mocks.auth.user = null;
    mocks.auth.isAuthenticated = false;

    render(<AdminLayout />);

    await waitFor(() => {
      expect(screen.getByTestId('redirect').textContent).toBe('/(auth)/login');
    });

    expect(mocks.analyticsSync.useAdminAnalyticsSync).toHaveBeenCalledWith(
      null,
      mocks.merchant.merchant
    );
  });
});
