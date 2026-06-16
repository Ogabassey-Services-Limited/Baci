import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TopSellingProduct } from '@/hooks/useTopSellingProducts';
import { TopSellingProductItem } from './TopSellingProductItem';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: () => null,
  Ionicons: () => null,
  __esModule: true,
}));

vi.mock('@/components/ui/SafeImage', async () => {
  const React = await import('react');
  return {
    default: ({ source }: { source: { uri: string } }) =>
      React.createElement('div', {
        'aria-label': 'Top selling product',
        'data-src': source.uri,
        role: 'img',
      }),
    __esModule: true,
  };
});

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: {
      backgroundLight: '#f8fafc',
      card: '#ffffff',
      cardHover: '#f1f5f9',
      gold: '#d97706',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
    },
    shadows: { sm: {} },
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      accessibilityHint,
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityHint?: string;
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-description': accessibilityHint,
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: { create: (styles: Record<string, unknown>) => styles },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const product: TopSellingProduct = {
  available_conditions: null,
  brand: null,
  brand_id: null,
  category: null,
  category_id: null,
  color: null,
  compare_at_price: null,
  condition: null,
  cost_price: null,
  created_at: '2026-06-16T00:00:00Z',
  default_variant_id: null,
  description: null,
  fulfillment_details: null,
  has_variants: false,
  id: 'product-1',
  images: ['https://example.com/bestseller.jpg'],
  inventory_tracking_policy: null,
  low_stock_threshold: null,
  manage_stock: false,
  max_variant_price: null,
  migration_status: null,
  min_variant_price: null,
  name: 'Best Seller',
  price: 250_000,
  sku: null,
  slug: 'best-seller',
  status: 'active',
  stock: 0,
  stock_quantity: 0,
  totalRevenue: 1_250_000,
  totalSold: 1_200,
  updated_at: '2026-06-16T00:00:00Z',
  variant_attributes: null,
  variant_model: null,
};

describe('TopSellingProductItem', () => {
  it('renders compact sales metrics and opens the product when pressed', () => {
    const onPress = vi.fn();
    render(
      <TopSellingProductItem
        item={product}
        currencySymbol="₦"
        onPress={onPress}
      />
    );

    expect(screen.getByText('Best Seller')).toBeInTheDocument();
    expect(screen.getByText('₦250,000')).toBeInTheDocument();
    expect(screen.getByText(/1.2k sold/)).toBeInTheDocument();
    expect(screen.getByText(/₦1.25M rev/)).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: /Top seller: Best Seller/ })
    );

    expect(onPress).toHaveBeenCalledWith('product-1');
  });
});
