import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn().mockResolvedValue(undefined),
  refreshAfterVerification: vi.fn().mockResolvedValue(undefined),
  useKycVerificationRefresh: vi.fn(),
  useQuery: vi.fn(),
}));

interface VerificationCardProps {
  onVerified?: () => undefined | Promise<unknown>;
}

vi.mock('@tanstack/react-query', () => ({
  useQuery: (...args: unknown[]) => mocks.useQuery(...args),
}));

vi.mock('expo-router', () => ({
  Stack: {
    Screen: () => null,
  },
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('@/components/kyc/NinVerificationCard', () => ({
  default: ({ onVerified }: VerificationCardProps) => (
    <button onClick={() => void onVerified?.()} type="button">
      Verify NIN
    </button>
  ),
}));

vi.mock('@/components/kyc/BvnVerificationCard', () => ({
  default: ({ onVerified }: VerificationCardProps) => (
    <button onClick={() => void onVerified?.()} type="button">
      Verify BVN
    </button>
  ),
}));

vi.mock('@/components/kyc/CacVerificationCard', () => ({
  default: ({ onVerified }: VerificationCardProps) => (
    <button onClick={() => void onVerified?.()} type="button">
      Verify CAC
    </button>
  ),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: {
      bvn: null,
      cac_rc_number: null,
      id: 'merchant-1',
      nin: null,
      phone: '+2348012345678',
      user_id: 'user-1',
    },
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#020617',
      card: '#111827',
      error: '#ef4444',
      primary: '#3b82f6',
      text: '#f8fafc',
      textMuted: '#94a3b8',
      textSecondary: '#94a3b8',
    },
    isDark: true,
  }),
}));

vi.mock('@/hooks/useKycVerificationRefresh', () => ({
  useKycVerificationRefresh: (...args: unknown[]) =>
    mocks.useKycVerificationRefresh(...args),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Pressable: ({
    children,
    onPress,
  }: {
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
}));

import KYCScreen from './kyc';

describe('KYCScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useQuery.mockReturnValue({
      data: {
        bvn_verified: false,
        cac_approved_name: null,
        cac_verified: false,
        date_of_birth: '1990-01-01',
        first_name: 'Ada',
        last_name: 'Lovelace',
        nin_verified: false,
      },
      isError: false,
      isLoading: false,
      refetch: mocks.refetch,
    });
    mocks.useKycVerificationRefresh.mockReturnValue({
      refreshAfterVerification: mocks.refreshAfterVerification,
    });
  });

  it('uses the shared verification refresh callback for all KYC cards', () => {
    render(<KYCScreen />);

    expect(mocks.useKycVerificationRefresh).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      refetchVerificationStatus: mocks.refetch,
    });

    fireEvent.click(screen.getByRole('button', { name: /verify nin/i }));
    fireEvent.click(screen.getByRole('button', { name: /verify bvn/i }));
    fireEvent.click(screen.getByRole('button', { name: /verify cac/i }));

    expect(mocks.refreshAfterVerification).toHaveBeenCalledTimes(3);
  });

  it('shows a loading indicator while verification status is fetching', () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      isError: false,
      isLoading: true,
      refetch: mocks.refetch,
    });

    render(<KYCScreen />);

    expect(screen.getByText('loading')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /verify nin/i })
    ).not.toBeInTheDocument();
  });

  it('shows a retry banner when verification status fails to load', () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      isError: true,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<KYCScreen />);

    expect(
      screen.getByText(/failed to load verification status/i)
    ).toBeInTheDocument();
    const retry = screen.getByRole('button', { name: /try again/i });
    fireEvent.click(retry);
    expect(mocks.refetch).toHaveBeenCalledTimes(1);
  });
});
