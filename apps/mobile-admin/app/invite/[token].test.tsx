import '@testing-library/jest-dom/vitest';
import { render, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  auth: {
    isAuthenticated: false,
    isLoading: false,
    user: null as null | { email?: string | null },
  },
  clearPendingStaffInviteToken: vi.fn(),
  replace: vi.fn(),
  router: null as null | { replace: ReturnType<typeof vi.fn> },
  rpc: vi.fn(),
  savePendingStaffInviteToken: vi.fn(),
  token: 'token-123' as string | undefined,
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
    mocks.auth.user = null;
    mocks.clearPendingStaffInviteToken.mockReset();
    mocks.replace.mockReset();
    mocks.router = { replace: mocks.replace };
    mocks.rpc.mockReset();
    mocks.savePendingStaffInviteToken.mockReset();
    mocks.token = 'token-123';
  });

  it('stores the invite token and sends unauthenticated users to login', async () => {
    render(<StaffInviteScreen />);

    await waitFor(() => {
      expect(mocks.savePendingStaffInviteToken).toHaveBeenCalledWith(
        'token-123'
      );
    });

    expect(mocks.replace).toHaveBeenCalledWith('/(auth)/login');
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('accepts the invite for an authenticated user with the invited email', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com' };
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

  it('clears pending invite tokens after terminal accept failures', async () => {
    mocks.auth.isAuthenticated = true;
    mocks.auth.user = { email: 'staff@example.com' };
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
});
