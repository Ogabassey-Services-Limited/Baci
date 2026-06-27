import { render, screen } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AnalyticsProductsScreen from './products';

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  useLocalSearchParams: vi.fn(),
  useTopSellingProducts: vi.fn(),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Pressable: ({
      children,
      onPress,
    }: {
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement('button', { onClick: () => onPress?.() }, children),
    StatusBar: () => null,
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@shopify/flash-list', () => ({
  FlashList: ({
    ListEmptyComponent,
    ListHeaderComponent,
    data,
    renderItem,
  }: {
    ListEmptyComponent?: React.ReactNode;
    ListHeaderComponent?: React.ReactNode;
    data?: Array<{ id: string; name: string }>;
    renderItem: ({
      item,
      index,
    }: {
      item: { id: string; name: string };
      index: number;
    }) => React.ReactNode;
  }) => (
    <div>
      {ListHeaderComponent}
      {(data ?? []).length === 0 ? ListEmptyComponent : null}
      {(data ?? []).map((item, index) => (
        <div key={item.id}>{renderItem({ item, index })}</div>
      ))}
    </div>
  ),
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,
  default: () => null,
  __esModule: true,
}));

vi.mock('expo-router', async () => {
  const React = await import('react');
  return {
    Stack: { Screen: () => React.createElement('div') },
    useLocalSearchParams: mocks.useLocalSearchParams,
    useRouter: () => ({ push: mocks.push }),
  };
});

vi.mock('@/hooks/useCurrency', () => ({
  useCurrency: () => ({ format: (amount: number) => `NGN ${amount}` }),
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      background: '#fff',
      border: '#e5e7eb',
      card: '#fff',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#111827',
      textMuted: '#6b7280',
      textOnPrimary: '#fff',
      textSecondary: '#4b5563',
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
    mocks.useLocalSearchParams.mockReturnValue({ filterLabel: 'This year' });
    mocks.useTopSellingProducts.mockReturnValue({
      data: [],
      isError: false,
      isLoading: true,
      refetch: vi.fn(),
    });
  });

  it('renders the top products loading state', () => {
    render(<AnalyticsProductsScreen />);

    expect(screen.getByRole('progressbar')).toBeTruthy();
  });
});
