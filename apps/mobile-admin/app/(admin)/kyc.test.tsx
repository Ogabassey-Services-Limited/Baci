import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { type ReactNode, useState } from 'react';
import { Text } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  merchant: {
    bvn: null,
    cac_rc_number: null,
    country: 'NG',
    id: 'merchant-1',
    nin: null,
    phone: '+2348012345678',
    user_id: 'user-1',
  },
  refetch: vi.fn().mockResolvedValue(undefined),
  refreshAfterVerification: vi.fn().mockResolvedValue(undefined),
  useKycVerificationRefresh: vi.fn(),
  useQuery: vi.fn(),
}));

interface VerificationCardProps {
  bvnVerified?: boolean;
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

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/kyc/NinVerificationCard', () => ({
  default: ({ bvnVerified, onVerified }: VerificationCardProps) => {
    const [nin, setNin] = useState('');

    return (
      <>
        <input
          aria-label="Merchant-scoped NIN draft"
          onChange={(event) => setNin(event.target.value)}
          value={nin}
        />
        <button onClick={() => void onVerified?.()} type="button">
          <Text>{bvnVerified ? 'Identity verified' : 'Verify identity'}</Text>
        </button>
      </>
    );
  },
}));

vi.mock('@/components/kyc/BvnVerificationCard', () => ({
  default: ({ onVerified }: VerificationCardProps) => (
    <button onClick={() => void onVerified?.()} type="button">
      <Text>Verify BVN</Text>
    </button>
  ),
}));

vi.mock('@/components/kyc/CacVerificationCard', () => ({
  default: ({ onVerified }: VerificationCardProps) => (
    <button onClick={() => void onVerified?.()} type="button">
      <Text>Verify CAC</Text>
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
    merchant: mocks.merchant,
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

vi.mock('react-native', () => {
  const MockText = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    StatusBar: () => null,
    ActivityIndicator: () => <MockText>loading</MockText>,
    KeyboardAvoidingView: ({
      behavior,
      children,
    }: {
      behavior?: string;
      children?: ReactNode;
    }) => (
      <section aria-label="KYC keyboard avoiding view" data-behavior={behavior}>
        {children}
      </section>
    ),
    Platform: { OS: 'ios' },
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
    ScrollView: ({
      children,
      keyboardDismissMode,
    }: {
      children?: ReactNode;
      keyboardDismissMode?: string;
    }) => (
      <section
        aria-label="KYC keyboard scroll view"
        data-keyboard-dismiss-mode={keyboardDismissMode}
      >
        {children}
      </section>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: MockText,
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  ),
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

import KYCScreen from './kyc';

describe('KYCScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchant = {
      bvn: null,
      cac_rc_number: null,
      country: 'NG',
      id: 'merchant-1',
      nin: null,
      phone: '+2348012345678',
      user_id: 'user-1',
    };
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

  it('uses one staged identity card and the shared refresh callback for KYC', () => {
    render(<KYCScreen />);

    expect(mocks.useKycVerificationRefresh).toHaveBeenCalledWith({
      merchantId: 'merchant-1',
      refetchVerificationStatus: mocks.refetch,
    });

    fireEvent.click(screen.getByRole('button', { name: /verify identity/i }));
    fireEvent.click(screen.getByRole('button', { name: /verify cac/i }));

    expect(
      screen.queryByRole('button', { name: /verify bvn/i })
    ).not.toBeInTheDocument();
    expect(mocks.refreshAfterVerification).toHaveBeenCalledTimes(2);
  });

  it('resets KYC card drafts when merchants switch with identical prefills', () => {
    const { rerender } = render(<KYCScreen />);
    const draft = screen.getByRole('textbox', {
      name: 'Merchant-scoped NIN draft',
    });

    fireEvent.change(draft, { target: { value: '12520824805' } });
    expect(draft).toHaveValue('12520824805');

    mocks.merchant = {
      ...mocks.merchant,
      id: 'merchant-2',
    };
    rerender(<KYCScreen />);

    expect(
      screen.getByRole('textbox', { name: 'Merchant-scoped NIN draft' })
    ).toHaveValue('');
  });

  it('keeps BVN fields scrollable above the iOS keyboard', () => {
    render(<KYCScreen />);

    expect(
      screen.getByRole('region', { name: 'KYC keyboard avoiding view' })
    ).toHaveAttribute('data-behavior', 'padding');
    expect(
      screen.getByRole('region', { name: 'KYC keyboard scroll view' })
    ).toHaveAttribute('data-keyboard-dismiss-mode', 'interactive');
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
      screen.queryByRole('button', { name: /verify identity/i })
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
