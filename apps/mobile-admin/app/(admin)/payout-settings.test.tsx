import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PayoutSettingsScreen from './payout-settings';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  accountName: null as string | null,
  routeParams: {} as { from?: string },
  routerBack: vi.fn(),
  isVerifying: false,
  keyboardContainerProps: [] as Array<{
    align?: 'start' | 'center' | 'end';
    scrollEnabled?: boolean;
    style?: unknown;
  }>,
  savePayoutSettings: {
    isPending: false,
    mutate: vi.fn(),
  },
  merchantData: {
    id: 'merchant-1',
    bank_account_number: null as string | null,
    bank_code: null as string | null,
    bank_name: null as string | null,
    business_name: 'Baci Store',
  },
  activeMerchantData: {
    id: 'merchant-1',
    bank_account_number: null as string | null,
    bank_code: null as string | null,
    bank_name: null as string | null,
    business_name: 'Baci Store',
  },
  verifyError: null as string | null,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useLocalSearchParams: () => mocks.routeParams,
    useRouter: () => ({ back: mocks.routerBack }),
    Stack: {
      Screen: ({
        options,
      }: {
        options?: {
          headerLeft?: () => React.ReactNode;
          headerRight?: () => React.ReactNode;
        };
      }) =>
        React.createElement(
          'div',
          null,
          options?.headerLeft ? options.headerLeft() : null,
          options?.headerRight ? options.headerRight() : null
        ),
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: mocks.merchantData,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'token' },
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: mocks.activeMerchantData,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePayouts', () => ({
  usePayouts: () => ({
    savePayoutSettings: mocks.savePayoutSettings,
  }),
}));

vi.mock('@/hooks/usePaystackBanks', () => ({
  usePaystackBanks: () => ({
    data: [
      { active: true, code: '001', id: 1, name: 'GTBank', slug: 'gtbank' },
      { active: true, code: '002', id: 2, name: 'Access Bank', slug: 'access' },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePayoutAccountVerification', () => ({
  usePayoutAccountVerification: () => ({
    accountName: mocks.accountName,
    isVerifying: mocks.isVerifying,
    verifyError: mocks.verifyError,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#0b0b1a',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      info: '#0369a1',
      infoLight: '#e0f2fe',
      primary: '#2563eb',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#0f172a',
      textMuted: '#64748b',
      textSecondary: '#334155',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {},
}));

vi.mock('@/components/ui/AppKeyboardContainer', () => ({
  AppKeyboardContainer: ({
    align,
    children,
    scrollEnabled,
    style,
  }: {
    align?: 'start' | 'center' | 'end';
    children?: ReactNode;
    scrollEnabled?: boolean;
    style?: unknown;
  }) => {
    mocks.keyboardContainerProps.push({ align, scrollEnabled, style });
    return <section aria-label="bank-modal-keyboard">{children}</section>;
  },
}));

vi.mock('@react-native-vector-icons/ionicons', () => {
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    Ionicons: () => <Text>icon</Text>,

    default: () => <Text>icon</Text>,
    __esModule: true,
  };
});

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('react-native', () => {
  const Text = ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  );

  return {
    StatusBar: () => null,
    ActivityIndicator: () => <Text>loading</Text>,
    Alert: { alert: mocks.alert },
    FlatList: ({
      data,
      renderItem,
    }: {
      data: Array<{ code: string; name: string }>;
      renderItem: (props: {
        item: { code: string; name: string };
      }) => ReactNode;
    }) => <div>{data.map((item) => renderItem({ item }))}</div>,
    Modal: ({
      children,
      visible,
    }: {
      children?: ReactNode;
      visible?: boolean;
    }) => (visible ? <div>{children}</div> : null),
    Platform: { OS: 'ios' },
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: ReactNode;
      onPress?: () => void;
    }) => (
      <button
        aria-label={accessibilityLabel}
        onClick={() => onPress?.()}
        type="button"
      >
        {children}
      </button>
    ),
    ScrollView: ({ children }: { children?: ReactNode }) => (
      <div>{children}</div>
    ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text,
    TextInput: ({
      onChangeText,
      placeholder,
      value,
    }: {
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) => (
      <input
        onChange={(event) => onChangeText?.(event.target.value)}
        placeholder={placeholder}
        value={value}
      />
    ),
    View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  };
});

describe('PayoutSettingsScreen', () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.accountName = null;
    mocks.isVerifying = false;
    mocks.keyboardContainerProps = [];
    mocks.merchantData = {
      id: 'merchant-1',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };
    mocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };
    mocks.savePayoutSettings.mutate.mockReset();
    mocks.routeParams = {};
    mocks.routerBack.mockReset();
    mocks.verifyError = null;
  });

  it('renders bank and account fields in the settings form', () => {
    render(<PayoutSettingsScreen />);

    expect(screen.getByText('Bank Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Select bank')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0123456789')).toBeInTheDocument();
  });

  it('seeds bank details and the payout business name from the active accessible merchant', () => {
    mocks.merchantData = {
      id: 'owner-merchant',
      bank_account_number: '1111111111',
      bank_code: '002',
      bank_name: 'Access Bank',
      business_name: 'Owner Store',
    };
    mocks.activeMerchantData = {
      id: 'accessible-merchant',
      bank_account_number: '2222222222',
      bank_code: '001',
      bank_name: 'GTBank',
      business_name: 'Accessible Store',
    };
    mocks.accountName = 'Accessible Store Ltd';

    render(<PayoutSettingsScreen />);

    expect(screen.getByPlaceholderText('0123456789')).toHaveValue('2222222222');
    expect(screen.getByText('GTBank')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.savePayoutSettings.mutate).toHaveBeenCalledWith(
      expect.objectContaining({
        accountNumber: '2222222222',
        bankCode: '001',
        businessName: 'Accessible Store',
      }),
      expect.any(Object)
    );
  });

  it('clears a prior merchant bank selection when the active merchant has no saved bank', () => {
    mocks.activeMerchantData = {
      id: 'merchant-a',
      bank_account_number: '1111111111',
      bank_code: '001',
      bank_name: 'GTBank',
      business_name: 'First Store',
    };
    const rendered = render(<PayoutSettingsScreen />);

    expect(screen.getByText('GTBank')).toBeInTheDocument();

    mocks.activeMerchantData = {
      id: 'merchant-b',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Second Store',
    };
    rendered.rerender(<PayoutSettingsScreen />);

    expect(screen.getByText('Select your bank')).toBeInTheDocument();
  });

  it('uses the shared keyboard container in the bank picker modal', () => {
    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));

    expect(screen.getByText('Select Bank')).toBeInTheDocument();
    expect(screen.getByLabelText('bank-modal-keyboard')).toBeInTheDocument();
    expect(
      mocks.keyboardContainerProps.some(
        (entry) => entry.align === 'start' && entry.scrollEnabled === false
      )
    ).toBe(true);
  });

  it('paints the bank picker keyboard container through the bottom safe area', () => {
    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));

    expect(mocks.keyboardContainerProps.at(-1)?.style).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ backgroundColor: '#0b0b1a' }),
      ])
    );
  });

  it('blocks save when account verification has not produced an account name', () => {
    mocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: '0123456789',
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };

    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.savePayoutSettings.mutate).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Please wait for account verification'
    );
  });

  it('blocks save when account verification is still in progress', () => {
    mocks.isVerifying = true;
    mocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: '0123456789',
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };

    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.savePayoutSettings.mutate).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Please wait for account verification'
    );
  });

  it('blocks save when account verification reports an error', () => {
    mocks.verifyError = 'Unable to verify account';
    mocks.activeMerchantData = {
      id: 'merchant-1',
      bank_account_number: '0123456789',
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    };

    render(<PayoutSettingsScreen />);

    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(mocks.savePayoutSettings.mutate).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Cannot save: Unable to verify account'
    );
  });

  it('returns to the checklist without a success alert after a checklist payout save', () => {
    mocks.accountName = 'Baci Store';
    mocks.routeParams = { from: 'setup' };

    render(<PayoutSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('0123456789'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const options = mocks.savePayoutSettings.mutate.mock.calls[0]?.[1] as
      | { onSuccess?: () => void }
      | undefined;
    options?.onSuccess?.();

    expect(mocks.routerBack).toHaveBeenCalledTimes(1);
    expect(mocks.alert).not.toHaveBeenCalledWith(
      'Success',
      expect.any(String),
      expect.any(Array)
    );
  });

  it('ignores payout completion callbacks after the merchant switches', () => {
    mocks.accountName = 'Baci Store';
    mocks.routeParams = { from: 'setup' };
    const rendered = render(<PayoutSettingsScreen />);
    fireEvent.change(screen.getByPlaceholderText('0123456789'), {
      target: { value: '0123456789' },
    });
    fireEvent.click(screen.getByLabelText('Select bank'));
    fireEvent.click(screen.getByText('GTBank'));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    const callbacks = mocks.savePayoutSettings.mutate.mock.calls[0]?.[1] as
      | { onError?: (error: Error) => void; onSuccess?: () => void }
      | undefined;
    mocks.activeMerchantData = {
      id: 'merchant-2',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Second Store',
    };
    rendered.rerender(<PayoutSettingsScreen />);
    callbacks?.onSuccess?.();
    callbacks?.onError?.(new Error('Save failed'));

    expect(mocks.routerBack).not.toHaveBeenCalled();
    expect(mocks.alert).not.toHaveBeenCalled();
  });
});
