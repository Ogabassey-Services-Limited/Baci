import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Hoisted mocks ───────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
  auth: {
    user: { id: 'user-1' },
    session: { access_token: 'tok' },
  },
  verification: {
    accountName: null as string | null,
    isVerifying: false,
    verifyError: null as string | null,
  },
  banks: {
    data: [
      { id: 1, name: 'GTBank', slug: 'gtbank', code: '058', active: true },
    ],
    isLoading: false,
  },
  savePayoutSettings: {
    mutate: vi.fn(),
    isPending: false,
  },
  merchant: {
    data: {
      id: 'merchant-1',
      business_name: 'Baci Store',
      bank_name: null,
      bank_account_number: null,
      bank_code: null,
    },
    isLoading: false,
  },
  router: { back: vi.fn() },
  Alert: { alert: vi.fn() },
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('@/hooks/usePayoutAccountVerification', () => ({
  usePayoutAccountVerification: () => mocks.verification,
}));
vi.mock('@/hooks/usePaystackBanks', () => ({
  usePaystackBanks: () => mocks.banks,
}));
vi.mock('@/hooks/usePayouts', () => ({
  usePayouts: () => ({ savePayoutSettings: mocks.savePayoutSettings }),
}));
vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      card: '#f5f5f5',
      text: '#000',
      textSecondary: '#666',
      textMuted: '#999',
      border: '#ddd',
      primary: '#6200ea',
      success: '#4caf50',
      successLight: '#e8f5e9',
      error: '#f44336',
      info: '#2196f3',
      infoLight: '#e3f2fd',
    },
    shadows: { sm: {} },
  }),
}));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: mocks.merchant.data, error: null }),
        }),
      }),
    }),
  },
}));
vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: Object.assign(
      ({ children }: { children?: React.ReactNode }) => children,
      {
        // Render headerRight so the Save button is accessible in tests
        Screen: ({
          options,
        }: {
          options?: { headerRight?: () => React.ReactNode };
        }) =>
          options?.headerRight
            ? React.createElement(
                'div',
                { 'data-testid': 'screen-header' },
                options.headerRight()
              )
            : null,
      }
    ),
    useRouter: () => mocks.router,
  };
});
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: React.ReactNode }) => children,
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQuery: vi
      .fn()
      .mockReturnValue({ data: mocks.merchant.data, isLoading: false }),
  };
});
vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    ActivityIndicator: () => null,
    Alert: mocks.Alert,
    FlatList: ({
      data,
      renderItem,
    }: {
      data: unknown[];
      renderItem: (info: { item: unknown }) => React.ReactNode;
    }) =>
      React.createElement(
        'div',
        null,
        data.map((item, i) =>
          React.createElement('div', { key: i }, renderItem({ item }))
        )
      ),
    KeyboardAvoidingView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) =>
      visible
        ? React.createElement('div', { 'data-testid': 'modal' }, children)
        : null,
    Pressable: ({
      children,
      onPress,
      accessibilityLabel,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
      accessibilityLabel?: string;
    }) =>
      React.createElement(
        'button',
        { onClick: onPress, 'aria-label': accessibilityLabel },
        children
      ),
    Platform: {
      OS: 'ios',
    },
    ScrollView: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: { create: (s: unknown) => s, hairlineWidth: 1 },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      value,
      onChangeText,
      placeholder,
    }: {
      value?: string;
      onChangeText?: (v: string) => void;
      placeholder?: string;
    }) =>
      React.createElement('input', {
        value,
        onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(e.target.value),
        placeholder,
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});
vi.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
vi.mock('@/constants/theme', () => ({
  RADIUS: { lg: 8, md: 4, sm: 2 },
  SPACING: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 },
  TYPOGRAPHY: {
    size: { sm: 12, md: 14, lg: 18 },
    fontFamily: {
      regular: 'System',
      medium: 'System',
      semiBold: 'System',
      bold: 'System',
    },
  },
}));

// ─── Import under test (after all mocks) ────────────────────────────────────

import PayoutSettingsScreen from '@/app/(admin)/payout-settings';

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('PayoutSettingsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verification.accountName = null;
    mocks.verification.isVerifying = false;
    mocks.verification.verifyError = null;
    mocks.savePayoutSettings.isPending = false;
  });

  it('displays the verified account name when verification succeeds', () => {
    mocks.verification.accountName = 'John Doe';

    render(<PayoutSettingsScreen />);

    expect(screen.getByText('John Doe')).toBeTruthy();
  });

  it('shows an alert and blocks save when accountName is null and not verifying', () => {
    mocks.verification.accountName = null;
    mocks.verification.isVerifying = false;

    render(<PayoutSettingsScreen />);

    // Pass the earlier guards so the verification guard is reached
    const input = screen.getByPlaceholderText('0123456789');
    fireEvent.change(input, { target: { value: '0141691337' } });
    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));

    fireEvent.click(screen.getByText('Save'));

    expect(mocks.Alert.alert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('verification')
    );
    expect(mocks.savePayoutSettings.mutate).not.toHaveBeenCalled();
  });

  it('shows an alert and blocks save when isVerifying is true (pending — regression for && → || fix)', () => {
    mocks.verification.accountName = null;
    mocks.verification.isVerifying = true;

    render(<PayoutSettingsScreen />);

    // Pass the earlier guards so the verification guard is reached
    const input = screen.getByPlaceholderText('0123456789');
    fireEvent.change(input, { target: { value: '0141691337' } });
    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));

    fireEvent.click(screen.getByText('Save'));

    expect(mocks.Alert.alert).toHaveBeenCalledWith(
      'Error',
      expect.stringContaining('verification')
    );
    expect(mocks.savePayoutSettings.mutate).not.toHaveBeenCalled();
  });

  it('calls savePayoutSettings when accountName is set and not verifying', () => {
    mocks.verification.accountName = 'John Doe';
    mocks.verification.isVerifying = false;

    render(<PayoutSettingsScreen />);

    // Enter a 10-digit account number so the account-number guard passes
    const input = screen.getByPlaceholderText('0123456789');
    fireEvent.change(input, { target: { value: '0141691337' } });

    // Select a bank via the picker button
    fireEvent.click(screen.getByLabelText('Select bank'));
    const bankButton = screen.getByText('GTBank');
    fireEvent.click(bankButton);

    fireEvent.click(screen.getByText('Save'));

    expect(mocks.savePayoutSettings.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ accountNumber: '0141691337', bankCode: '058' }),
      expect.any(Object)
    );
  });
});
