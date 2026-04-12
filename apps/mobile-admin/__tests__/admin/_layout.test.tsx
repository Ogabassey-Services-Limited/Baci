import { render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: true,
    isLoading: false,
    user: { id: 'user-1' },
  },
  merchant: {
    merchant: { id: 'merchant-1' },
  },
  push: {
    isLoading: false,
    isRegistered: false,
    registerPush: vi.fn().mockResolvedValue(undefined),
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

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 59, right: 0, bottom: 34, left: 0 }),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');

  const Stack = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(
      'div',
      {
        'data-testid': 'admin-stack',
        'aria-label': 'admin stack',
        role: 'main',
      },
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

import AdminLayout from '@/app/(admin)/_layout';

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.auth.isAuthenticated = true;
    mocks.auth.isLoading = false;
    mocks.auth.user = { id: 'user-1' };
    mocks.merchant.merchant = { id: 'merchant-1' };
    mocks.push.isLoading = false;
    mocks.push.isRegistered = false;
  });

  it('registers push notifications when auth and merchant context are ready', async () => {
    render(<AdminLayout />);

    await waitFor(() => {
      expect(mocks.push.registerPush).toHaveBeenCalledTimes(1);
      expect(mocks.push.registerPush).toHaveBeenCalledWith(
        'user-1',
        'merchant-1'
      );
    });
  });

  it('skips registration when the session is already registered', async () => {
    mocks.push.isRegistered = true;

    render(<AdminLayout />);

    await waitFor(() => {
      expect(screen.getByRole('main', { name: 'admin stack' })).toBeTruthy();
    });

    expect(mocks.push.registerPush).not.toHaveBeenCalled();
  });

  it('does not crash when push registration rejects', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mocks.push.registerPush = vi
      .fn()
      .mockRejectedValue(new Error('register failed'));

    render(<AdminLayout />);

    await waitFor(() => {
      expect(screen.getByRole('main', { name: 'admin stack' })).toBeTruthy();
    });

    expect(mocks.push.registerPush).toHaveBeenCalledTimes(1);
    expect(mocks.push.registerPush).toHaveBeenCalledWith(
      'user-1',
      'merchant-1'
    );

    consoleErrorSpy.mockRestore();
  });
});
