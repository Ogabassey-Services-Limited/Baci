import '@testing-library/jest-dom/vitest';
import type { ReactNode } from 'react';
import { vi } from 'vitest';

type QueryConfig = {
  queryFn: () => Promise<unknown>;
};

type MutationConfig = {
  onError?: (
    error: Error,
    variables: unknown,
    context?: { previousSettings?: unknown }
  ) => void;
};

interface MockUseMerchantResult {
  isLoading: boolean;
  merchant: { id: string } | null;
  error: Error | null;
}

const hoistedMocks = vi.hoisted(() => ({
  alert: vi.fn(),
  eq: vi.fn(),
  invalidateQueries: vi.fn(),
  mutate: vi.fn(),
  mutationConfig: undefined as MutationConfig | undefined,
  openURL: vi.fn(),
  refetch: vi.fn(),
  select: vi.fn(),
  setQueryData: vi.fn(),
  single: vi.fn(),
  useMerchantResult: {
    isLoading: false,
    merchant: { id: 'merchant-1' },
    error: null,
  } as MockUseMerchantResult,
  useQuery: vi.fn(),
}));

export const mocks = hoistedMocks;

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: {
      Screen: () => React.createElement('div', null),
    },
  };
});

vi.mock('@tanstack/react-query', () => ({
  useMutation: (config: MutationConfig) => {
    mocks.mutationConfig = config;
    return {
      isPending: false,
      mutate: mocks.mutate,
    };
  },
  useQuery: (config: QueryConfig) => mocks.useQuery(config),
  useQueryClient: () => ({
    cancelQueries: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: mocks.invalidateQueries,
    setQueryData: mocks.setQueryData,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      cardHover: '#f1f5f9',
      info: '#2563eb',
      infoLight: '#eff6ff',
      notification: '#dc2626',
      primary: '#2563eb',
      success: '#16a34a',
      successLight: '#dcfce7',
      text: '#0f172a',
      textMuted: '#64748b',
      textSecondary: '#334155',
    },
    isDark: false,
    shadows: { sm: {} },
  }),
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => mocks.useMerchantResult,
}));

vi.mock('@/components/ui/ScreenSkeleton', () => ({
  ScreenSkeleton: () => <div>loading</div>,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: () => ({
      select: mocks.select,
    }),
  },
}));

vi.mock('react-native-edge-to-edge', () => ({
  SystemBars: () => null,
}));

vi.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children?: ReactNode }) => (
    <section>{children}</section>
  ),
}));

vi.mock('react-native', () => ({
  Alert: { alert: mocks.alert },
  Linking: { openURL: mocks.openURL },
  Pressable: ({
    accessibilityLabel,
    children,
    onPress,
  }: {
    accessibilityLabel?: string;
    children?: ReactNode;
    onPress?: () => void;
  }) => (
    <button aria-label={accessibilityLabel} onClick={onPress} type="button">
      {children}
    </button>
  ),
  ScrollView: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
  },
  Switch: ({
    accessibilityLabel,
    disabled,
    onValueChange,
    value,
  }: {
    accessibilityLabel?: string;
    disabled?: boolean;
    onValueChange?: (value: boolean) => void;
    value?: boolean;
  }) => (
    <input
      aria-label={accessibilityLabel}
      checked={!!value}
      disabled={disabled}
      onChange={(event) => onValueChange?.(event.currentTarget.checked)}
      type="checkbox"
    />
  ),
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => <span>icon</span>,
  default: () => <span>icon</span>,
  __esModule: true,
}));

export const paymentSettings = {
  id: 'settings-1',
  merchant_id: 'merchant-1',
  paystack_enabled: true,
  korapay_enabled: true,
  credit_direct_enabled: false,
  credpal_enabled: false,
  pay_on_delivery_enabled: true,
  juicyway_enabled: false,
  klump_enabled: true,
};

export function resetPaymentMethodsScreenMocks() {
  mocks.alert.mockReset();
  mocks.eq.mockReset();
  mocks.invalidateQueries.mockReset();
  mocks.mutate.mockReset();
  mocks.mutationConfig = undefined;
  mocks.openURL.mockReset();
  mocks.refetch.mockReset();
  mocks.select.mockReset();
  mocks.setQueryData.mockReset();
  mocks.single.mockReset();
  mocks.useMerchantResult = {
    isLoading: false,
    merchant: { id: 'merchant-1' },
    error: null,
  };
  mocks.useQuery.mockReset();
  mocks.single.mockResolvedValue({ data: paymentSettings, error: null });
  mocks.eq.mockReturnValue({ single: mocks.single });
  mocks.select.mockReturnValue({ eq: mocks.eq });
  mocks.useQuery.mockReturnValue({
    data: paymentSettings,
    error: null,
    isError: false,
    isLoading: false,
    refetch: mocks.refetch,
  });
}
