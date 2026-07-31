import type { ReactNode } from 'react';
import { vi } from 'vitest';

export const payoutSettingsMocks = {
  accountName: null as string | null,
  activeMerchantData: {
    id: 'merchant-1',
    bank_account_number: null as string | null,
    bank_code: null as string | null,
    bank_name: null as string | null,
    business_name: 'Baci Store',
  },
  alert: vi.fn(),
  isVerifying: false,
  pageSheetProps: [] as Array<{
    closeLabel?: string;
    scrollEnabled?: boolean;
    title: string;
  }>,
  routeParams: {} as { from?: string },
  routerBack: vi.fn(),
  savePayoutSettings: { isPending: false, mutate: vi.fn() },
  verifyError: null as string | null,
};

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
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
    useLocalSearchParams: () => payoutSettingsMocks.routeParams,
    useRouter: () => ({ back: payoutSettingsMocks.routerBack }),
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    session: { access_token: 'token' },
    user: { id: 'user-1' },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    merchant: payoutSettingsMocks.activeMerchantData,
    isLoading: false,
  }),
}));

vi.mock('@/hooks/usePayouts', () => ({
  usePayouts: () => ({
    savePayoutSettings: payoutSettingsMocks.savePayoutSettings,
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
    accountName: payoutSettingsMocks.accountName,
    isVerifying: payoutSettingsMocks.isVerifying,
    verifyError: payoutSettingsMocks.verifyError,
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

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    closeLabel,
    onClose,
    scrollEnabled,
    title,
    visible,
  }: {
    children?: ReactNode;
    closeLabel?: string;
    onClose: () => void;
    scrollEnabled?: boolean;
    title: string;
    visible: boolean;
  }) => {
    payoutSettingsMocks.pageSheetProps.push({
      closeLabel,
      scrollEnabled,
      title,
    });
    return visible ? (
      <section aria-label="shared-bank-picker-sheet">
        <button aria-label={closeLabel} onClick={onClose} type="button">
          close
        </button>
        <h1>{title}</h1>
        {children}
      </section>
    ) : null;
  },
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: () => <span>icon</span>,
  Ionicons: () => <span>icon</span>,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <span>loading</span>,
  Alert: { alert: payoutSettingsMocks.alert },
  FlatList: ({
    data,
    renderItem,
  }: {
    data: Array<{ code: string; name: string }>;
    renderItem: (props: { item: { code: string; name: string } }) => ReactNode;
  }) => (
    <div>
      {data.map((item) => (
        <div key={item.code}>{renderItem({ item })}</div>
      ))}
    </div>
  ),
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
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StatusBar: () => null,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
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

export function resetPayoutSettingsMocks() {
  payoutSettingsMocks.accountName = null;
  payoutSettingsMocks.activeMerchantData = {
    id: 'merchant-1',
    bank_account_number: null,
    bank_code: null,
    bank_name: null,
    business_name: 'Baci Store',
  };
  payoutSettingsMocks.alert.mockReset();
  payoutSettingsMocks.isVerifying = false;
  payoutSettingsMocks.pageSheetProps = [];
  payoutSettingsMocks.routeParams = {};
  payoutSettingsMocks.routerBack.mockReset();
  payoutSettingsMocks.savePayoutSettings.mutate.mockReset();
  payoutSettingsMocks.verifyError = null;
}

export async function loadPayoutSettingsScreen() {
  return (await import('../../app/(admin)/payout-settings')).default;
}
