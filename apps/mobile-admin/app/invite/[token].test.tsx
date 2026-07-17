import '@testing-library/jest-dom/vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const invalidateQueries = vi.fn();
  return {
    auth: {
      isAuthenticated: false,
      isLoading: false,
      signOut: vi.fn(),
      user: null as null | { email?: string | null; id?: string },
    },
    clearPendingStaffInviteToken: vi.fn(),
    invalidateQueries,
    // A STABLE client object. The screen's accept effect lists `queryClient`
    // in its dependency array, so returning a new object on every render would
    // re-run the effect each render → setState → re-render → infinite loop that
    // OOMs the worker. The real useQueryClient returns a stable client too.
    queryClient: { invalidateQueries },
    replace: vi.fn(),
    router: null as null | { replace: ReturnType<typeof vi.fn> },
    rpc: vi.fn(),
    savePendingStaffInviteToken: vi.fn(),
    token: 'token-123' as string | undefined,
    unregisterPush: vi.fn(),
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => mocks.queryClient,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  Ionicons: () => null,
  __esModule: true,
}));

vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ token: mocks.token }),
  useRouter: () => mocks.router,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  const MockText = ({ children }: { children?: ReactNode }) =>
    React.createElement('span', null, children);

  return {
    ActivityIndicator: () => React.createElement('span', null, 'loading'),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        { onClick: () => onPress?.(), type: 'button' },
        children
      ),
    StyleSheet: {
      create: <T extends Record<string, unknown>>(styles: T) => styles,
    },
    Text: MockText,
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}));

vi.mock('@/hooks/usePushNotifications', () => ({
  usePushNotifications: () => ({ unregisterPush: mocks.unregisterPush }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      card: '#111827',
      error: '#ef4444',
      primary: '#3b82f6',
      success: '#22c55e',
      text: '#f8fafc',
      textOnPrimary: '#ffffff',
      textSecondary: '#94a3b8',
    },
  }),
}));

vi.mock('@/lib/staff-invite-pending', () => ({
  clearPendingStaffInviteToken: () => mocks.clearPendingStaffInviteToken(),
  normalizeStaffInviteToken: (value: string | string[] | null | undefined) => {
    const rawValue = Array.isArray(value) ? value[0] : value;
    return rawValue?.trim() || null;
  },
  savePendingStaffInviteToken: (token: string) =>
    mocks.savePendingStaffInviteToken(token),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mocks.rpc(...args),
  },
}));

import StaffInviteScreen from './[token]';

describe('StaffInviteScreen', () => {
  beforeEach(() => {
    mocks.auth.isAuthenticated = false;
    mocks.auth.isLoading = false;
    mocks.auth.signOut.mockReset();
    mocks.auth.signOut.mockResolvedValue(undefined);
    mocks.auth.user = null;
    mocks.clearPendingStaffInviteToken.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.invalidateQueries.mockResolvedValue(undefined);
    mocks.replace.mockReset();
    mocks.router = { replace: mocks.replace };
    mocks.rpc.mockReset();
    mocks.savePendingStaffInviteToken.mockReset();
    mocks.token = 'token-123';
    mocks.unregisterPush.mockReset();
  });

  it('stores the invite token and sends unauthenticated users to staff signup', async () => {
    render(<StaffInviteScreen />);

    await waitFor(() => {
      expect(mocks.savePendingStaffInviteToken).toHaveBeenCalledWith(
        'token-123'
      );
    });

    // Account-only staff signup, NOT merchant registration (which would create
    // an owner store and pin the invitee away from the invited store).
    expect(mocks.replace).toHaveBeenCalledWith('/(auth)/staff-signup');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('accepts the invite for an authenticated user with the invited email', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            email: 'staff@example.com',
            merchant_business_name: 'Ogabassey',
            role: 'sales_rep',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ id: 'staff-1' }], error: null });

    render(<StaffInviteScreen />);

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledWith('accept_staff_invite', {
        p_token: 'token-123',
        p_email: 'staff@example.com',
      });
    });

    expect(mocks.clearPendingStaffInviteToken).toHaveBeenCalled();
    expect(mocks.replace).toHaveBeenCalledWith('/(admin)/(tabs)');
  });

  it('refetches the merchant context before navigating to the admin tabs', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            email: 'staff@example.com',
            merchant_business_name: 'Ogabassey',
            role: 'sales_rep',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: [{ id: 'staff-1' }], error: null });

    render(<StaffInviteScreen />);

    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/(admin)/(tabs)');
    });

    expect(mocks.invalidateQueries).toHaveBeenCalledWith({
      queryKey: ['merchant', 'user-1'],
    });
  });

  it('clears pending invite tokens after terminal accept failures', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            email: 'staff@example.com',
            merchant_business_name: 'Ogabassey',
            role: 'sales_rep',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'invite_used' } });

    render(<StaffInviteScreen />);

    await waitFor(() => {
      expect(mocks.clearPendingStaffInviteToken).toHaveBeenCalled();
    });

    expect(mocks.replace).not.toHaveBeenCalledWith('/(admin)/(tabs)');
  });

  it('routes an already-authenticated user through the root guard after a terminal error', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc
      .mockResolvedValueOnce({
        data: [
          {
            email: 'staff@example.com',
            merchant_business_name: 'Ogabassey',
            role: 'sales_rep',
          },
        ],
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'invite_used' } });

    const { findByRole } = render(<StaffInviteScreen />);

    // Signed-in users get a dashboard affordance, not a misleading "Sign In".
    const dashboardButton = await findByRole('button', {
      name: 'Go to Dashboard',
    });
    dashboardButton.click();

    // Route through the root guard so a no-merchant account-only invitee isn't
    // dropped into an empty admin tab.
    await waitFor(() => {
      expect(mocks.replace).toHaveBeenCalledWith('/');
    });
    expect(mocks.replace).not.toHaveBeenCalledWith('/(admin)/(tabs)');
  });

  it('preserves the pending invite token when the preview RPC fails transiently', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network request failed' },
    });

    const { findByRole } = render(<StaffInviteScreen />);

    // A retry affordance is shown and the token is kept for a later attempt.
    await findByRole('button', { name: 'Try Again' });
    expect(mocks.clearPendingStaffInviteToken).not.toHaveBeenCalled();
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });

  it('retries the preview RPC after a transient failure', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Network request failed' },
      })
      .mockResolvedValueOnce({
        data: null,
        error: { message: 'Network request failed again' },
      });

    const { findByRole } = render(<StaffInviteScreen />);

    const retryButton = await findByRole('button', {
      name: 'Try Again',
    });
    retryButton.click();

    await waitFor(() => {
      expect(mocks.rpc).toHaveBeenCalledTimes(2);
    });
    expect(mocks.clearPendingStaffInviteToken).not.toHaveBeenCalled();
  });

  it('offers a Cancel escape hatch on a transient failure that clears the token', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com', id: 'user-1' };
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: 'Network request failed' },
    });

    const { findByRole } = render(<StaffInviteScreen />);

    const cancelButton = await findByRole('button', { name: 'Cancel' });
    cancelButton.click();

    // Cancel clears the pending token so the root guard can't loop back here.
    await waitFor(() => {
      expect(mocks.clearPendingStaffInviteToken).toHaveBeenCalled();
    });
    expect(mocks.replace).toHaveBeenCalledWith('/');
  });

  it('keeps the token and does not accept when the invite is for another email', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'someone-else@example.com', id: 'user-1' };
    mocks.rpc.mockResolvedValueOnce({
      data: [
        {
          email: 'invited@example.com',
          merchant_business_name: 'Ogabassey',
          role: 'sales_rep',
        },
      ],
      error: null,
    });

    const { findByRole } = render(<StaffInviteScreen />);

    const switchButton = await findByRole('button', {
      name: 'Sign in with a different account',
    });

    expect(mocks.savePendingStaffInviteToken).toHaveBeenCalledWith('token-123');
    expect(mocks.clearPendingStaffInviteToken).not.toHaveBeenCalled();
    // Only the preview RPC ran — acceptance never fired for the wrong account.
    expect(mocks.rpc).toHaveBeenCalledTimes(1);

    switchButton.click();

    await waitFor(() => {
      expect(mocks.auth.signOut).toHaveBeenCalled();
    });
    // Push token must be unregistered on sign-out (same cleanup as normal logout)
    // so the device isn't left registered to the wrong account.
    expect(mocks.auth.signOut).toHaveBeenCalledWith(mocks.unregisterPush);
    expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
  });
});
