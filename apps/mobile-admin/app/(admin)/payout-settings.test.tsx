import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import PayoutSettingsScreen from './payout-settings';

const mocks = vi.hoisted(() => ({
  keyboardContainerProps: [] as Array<{
    align?: 'start' | 'center' | 'end';
    scrollEnabled?: boolean;
  }>,
  savePayoutSettings: {
    isPending: false,
    mutate: vi.fn(),
  },
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    useRouter: () => ({ back: vi.fn() }),
    Stack: {
      Screen: ({
        options,
      }: {
        options?: { headerLeft?: () => React.ReactNode; headerRight?: () => React.ReactNode };
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
    data: {
      id: 'merchant-1',
      bank_account_number: null,
      bank_code: null,
      bank_name: null,
      business_name: 'Baci Store',
    },
    isLoading: false,
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'token' },
    user: { id: 'user-1' },
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
    accountName: null,
    isVerifying: false,
    verifyError: null,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
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
  }: {
    align?: 'start' | 'center' | 'end';
    children?: ReactNode;
    scrollEnabled?: boolean;
  }) => {
    mocks.keyboardContainerProps.push({ align, scrollEnabled });
    return <section aria-label="bank-modal-keyboard">{children}</section>;
  },
}));

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => <section>{children}</section>,
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: vi.fn() },
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ code: string; name: string }>;
    renderItem: (props: { item: { code: string; name: string } }) => ReactNode;
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
    <button aria-label={accessibilityLabel} onClick={() => onPress?.()} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
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
}));

describe('PayoutSettingsScreen', () => {
  it('renders bank and account fields in the settings form', () => {
    render(<PayoutSettingsScreen />);

    expect(screen.getByText('Bank Details')).toBeInTheDocument();
    expect(screen.getByLabelText('Select bank')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('0123456789')).toBeInTheDocument();
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
});
