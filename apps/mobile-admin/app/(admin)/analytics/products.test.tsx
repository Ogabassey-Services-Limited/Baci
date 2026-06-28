import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsProductsScreen from './products';

const mocks = vi.hoisted(() => ({
  refetch: vi.fn(),
  router: {
    push: vi.fn(),
  },
  useMerchant: vi.fn(),
  useRevenueCat: vi.fn(),
  useTopSellingProducts: vi.fn(),
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: {
      Screen: () => React.createElement('div'),
    },
    useLocalSearchParams: () => ({
      filterLabel: 'This month',
    }),
    useRouter: () => mocks.router,
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    data,
    ListEmptyComponent,
    ListHeaderComponent,
    renderItem,
  }: {
    data?: unknown[] | null;
    ListEmptyComponent?: ReactNode;
    ListHeaderComponent?: ReactNode;
    renderItem: (params: { index: number; item: unknown }) => ReactNode;
  }) => (
    <div>
      {ListHeaderComponent}
      {data && data.length > 0
        ? data.map((item, index) => (
            <div key={(item as { id?: string }).id ?? index}>
              {renderItem({ index, item })}
            </div>
          ))
        : ListEmptyComponent}
    </div>
  ),
}));

vi.mock('react-native', () => ({
  ActivityIndicator: () => <div role="progressbar" />,
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
  StatusBar: () => null,
  StyleSheet: {
    create: (styles: Record<string, unknown>) => styles,
    hairlineWidth: 1,
  },
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

vi.mock('@/components/billing/FeatureGateScreen', () => ({
  FeatureGateScreen: ({ children }: { children?: ReactNode }) => children,
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: mocks.useMerchant,
}));

vi.mock('@/hooks/useRevenueCat', () => ({
  useRevenueCat: mocks.useRevenueCat,
}));

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({
    format: (amount: number) => `NGN ${amount}`,
  }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#ffffff',
      border: '#e2e8f0',
      card: '#f8fafc',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#64748b',
      textOnPrimary: '#ffffff',
      textSecondary: '#475569',
    },
    isDark: false,
  }),
}));

vi.mock('@/hooks/useTopSellingProducts', () => ({
  useTopSellingProducts: mocks.useTopSellingProducts,
}));

describe('AnalyticsProductsScreen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.useMerchant.mockReturnValue({
      merchant: {
        id: 'merchant-1',
        plan_expires_at: null,
        plan_tier: 'free',
        premium_features: [],
      },
    });
    mocks.useRevenueCat.mockReturnValue({ isPro: true });
    mocks.useTopSellingProducts.mockReturnValue({
      data: [
        {
          id: 'product-1',
          name: 'Galaxy S26',
          totalRevenue: 120_000,
          totalSold: 2,
        },
      ],
      isError: false,
      isLoading: false,
      refetch: mocks.refetch,
    });
  });

  it('renders top-selling products for the selected period', () => {
    render(<AnalyticsProductsScreen />);

    expect(screen.getByText('Galaxy S26')).toBeTruthy();
    expect(screen.getByText('2 units sold')).toBeTruthy();
    expect(screen.getByText('NGN 120000')).toBeTruthy();
  });

  it('routes a product row to its product detail screen', () => {
    render(<AnalyticsProductsScreen />);

    fireEvent.click(screen.getByRole('button', { name: /Galaxy S26/i }));

    expect(mocks.router.push).toHaveBeenCalledWith('/product/product-1');
  });

  it('does not mount the products query for merchants without advanced analytics', () => {
    mocks.useRevenueCat.mockReturnValue({ isPro: false });

    render(<AnalyticsProductsScreen />);

    expect(mocks.useTopSellingProducts).not.toHaveBeenCalled();
  });
});
