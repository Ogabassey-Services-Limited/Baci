import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaymentMethodsScreen from './payment-methods';

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

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  invalidateQueries: vi.fn(),
  mutate: vi.fn(),
  mutationConfig: undefined as MutationConfig | undefined,
  openURL: vi.fn(),
  refetch: vi.fn(),
  select: vi.fn(),
  eq: vi.fn(),
  setQueryData: vi.fn(),
  single: vi.fn(),
  useQuery: vi.fn(),
  useMerchantResult: {
    isLoading: false,
    merchant: { id: 'merchant-1' },
    error: null,
  } as MockUseMerchantResult,
}));

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

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => <span>icon</span>,
}));

const paymentSettings = {
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

describe('PaymentMethodsScreen', () => {
  beforeEach(() => {
    mocks.alert.mockReset();
    mocks.invalidateQueries.mockReset();
    mocks.mutate.mockReset();
    mocks.mutationConfig = undefined;
    mocks.openURL.mockReset();
    mocks.refetch.mockReset();
    mocks.select.mockReset();
    mocks.eq.mockReset();
    mocks.setQueryData.mockReset();
    mocks.single.mockReset();
    mocks.useQuery.mockReset();
    mocks.useMerchantResult = {
      isLoading: false,
      merchant: { id: 'merchant-1' },
      error: null,
    };
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
  });

  it('renders Klump as a BNPL payment toggle', () => {
    render(<PaymentMethodsScreen />);

    expect(screen.getByText('Klump')).toBeInTheDocument();
    expect(screen.getByLabelText('Toggle Klump')).toBeChecked();
  });

  it('toggles the klump_enabled setting from rendered payment settings', () => {
    render(<PaymentMethodsScreen />);

    fireEvent.click(screen.getByLabelText('Toggle Klump'));
    expect(mocks.mutate).toHaveBeenCalledWith({
      field: 'klump_enabled',
      value: false,
    });
  });

  it('shows the payment settings error state when settings fail to load', () => {
    mocks.useQuery.mockReturnValue({
      data: undefined,
      error: new Error('Failed to fetch'),
      isError: true,
      isLoading: false,
      refetch: mocks.refetch,
    });

    render(<PaymentMethodsScreen />);

    expect(screen.getByText('Failed to load payment methods')).toBeInTheDocument();
    expect(screen.getByText('Failed to fetch')).toBeInTheDocument();
    expect(
      screen.getByLabelText('Retry loading payment methods')
    ).toBeInTheDocument();
  });

  it('shows the payment settings error state when the merchant fails to load', () => {
    mocks.useMerchantResult = {
      isLoading: false,
      merchant: null,
      error: new Error('Merchant not found'),
    };

    render(<PaymentMethodsScreen />);

    expect(screen.getByText('Failed to load payment methods')).toBeInTheDocument();
    expect(screen.getByText('Merchant not found')).toBeInTheDocument();
  });

  it('alerts and rolls back when a payment method toggle fails', () => {
    render(<PaymentMethodsScreen />);

    mocks.mutationConfig?.onError?.(
      new Error('Failed to update payment method'),
      { field: 'klump_enabled', value: false },
      { previousSettings: paymentSettings }
    );

    expect(mocks.alert).toHaveBeenCalledWith(
      'Error',
      'Failed to update payment method'
    );
    expect(mocks.setQueryData).toHaveBeenCalledWith(
      ['payment-settings', 'merchant-1'],
      paymentSettings
    );
  });

  it('retries payment settings fetch when PostgREST reports missing columns', async () => {
    let capturedQueryFn: (() => Promise<unknown>) | undefined;

    mocks.useQuery.mockImplementation((config: QueryConfig) => {
      capturedQueryFn = config.queryFn;
      return {
        data: paymentSettings,
        error: null,
        isError: false,
        isLoading: false,
        refetch: mocks.refetch,
      };
    });

    mocks.single
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the 'klump_enabled' column of 'merchant_feature_settings' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: null,
        error: {
          message:
            "Could not find the 'juicyway_enabled' column of 'merchant_feature_settings' in the schema cache",
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'settings-1',
          merchant_id: 'merchant-1',
          paystack_enabled: true,
          korapay_enabled: true,
          credpal_enabled: false,
          credit_direct_enabled: false,
          pay_on_delivery_enabled: true,
        },
        error: null,
      });

    render(<PaymentMethodsScreen />);

    expect(capturedQueryFn).toBeDefined();
    if (!capturedQueryFn) {
      throw new Error('Expected payment settings query function');
    }
    const result = await capturedQueryFn();

    expect(result).toEqual(
      expect.objectContaining({
        id: 'settings-1',
        merchant_id: 'merchant-1',
        klump_enabled: false,
        juicyway_enabled: false,
        paystack_enabled: true,
      })
    );

    const selectedColumns = mocks.select.mock.calls.map(
      ([columns]) => columns as string
    );
    expect(selectedColumns[0]).toContain('klump_enabled');
    expect(selectedColumns[0]).toContain('juicyway_enabled');
    expect(selectedColumns[1]).not.toContain('klump_enabled');
    expect(selectedColumns[1]).toContain('juicyway_enabled');
    expect(selectedColumns[2]).not.toContain('klump_enabled');
    expect(selectedColumns[2]).not.toContain('juicyway_enabled');
  });
});
