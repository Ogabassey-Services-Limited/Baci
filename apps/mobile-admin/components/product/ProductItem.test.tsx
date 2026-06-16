import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Product } from '@/hooks/useProducts';
import { ProductItem } from './ProductItem';

vi.mock('@react-native-vector-icons/ionicons', () => ({
  default: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  Ionicons: ({ name }: { name?: string }) => (
    <span aria-hidden="true" data-icon={name} />
  ),
  __esModule: true,
}));

vi.mock('@/components/ui/SafeImage', async () => {
  const React = await import('react');
  return {
    default: ({ source }: { source: { uri: string } }) =>
      React.createElement('div', {
        'aria-label': 'Product',
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
      error: '#ef4444',
      success: '#22c55e',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#64748b',
      warning: '#f59e0b',
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

const baseProduct: Product = {
  available_conditions: null,
  brand: null,
  brand_id: null,
  category: null,
  category_id: null,
  color: null,
  compare_at_price: 75_000,
  condition: null,
  cost_price: null,
  created_at: '2026-06-16T00:00:00Z',
  default_variant_id: null,
  description: null,
  fulfillment_details: null,
  has_variants: false,
  id: 'product-1',
  images: ['https://example.com/phone.jpg'],
  inventory_tracking_policy: null,
  low_stock_threshold: 5,
  manage_stock: true,
  max_variant_price: null,
  migration_status: null,
  min_variant_price: null,
  name: 'Galaxy Phone',
  price: 50_000,
  sku: null,
  slug: 'galaxy-phone',
  status: 'active',
  stock: 2,
  stock_quantity: 2,
  updated_at: '2026-06-16T00:00:00Z',
  variant_attributes: null,
  variant_model: null,
};

describe('ProductItem', () => {
  it('renders product pricing, image, and stock state', () => {
    render(
      <ProductItem item={baseProduct} currencySymbol="₦" onPress={vi.fn()} />
    );

    expect(screen.getByText('Galaxy Phone')).toBeInTheDocument();
    expect(screen.getByText('₦50,000')).toBeInTheDocument();
    expect(screen.getByText('₦75,000')).toBeInTheDocument();
    expect(screen.getByText('Low stock: 2')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Product' })).toHaveAttribute(
      'data-src',
      'https://example.com/phone.jpg'
    );
  });

  it('calls onPress with the product id', () => {
    const onPress = vi.fn();
    render(
      <ProductItem item={baseProduct} currencySymbol="₦" onPress={onPress} />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /Product: Galaxy Phone/ })
    );

    expect(onPress).toHaveBeenCalledWith('product-1');
  });

  it('renders the image fallback when no product image is available', () => {
    const { container } = render(
      <ProductItem
        item={{ ...baseProduct, images: [] }}
        currencySymbol="₦"
        onPress={vi.fn()}
      />
    );

    expect(
      screen.queryByRole('img', { name: 'Product' })
    ).not.toBeInTheDocument();
    expect(container.querySelector('[data-icon="image-outline"]')).toBeTruthy();
  });

  it('suppresses compare-at price when it is not greater than the sale price', () => {
    render(
      <ProductItem
        item={{ ...baseProduct, compare_at_price: 50_000 }}
        currencySymbol="₦"
        onPress={vi.fn()}
      />
    );

    expect(screen.getAllByText('₦50,000')).toHaveLength(1);
  });

  it('renders the regular in-stock bucket for healthy managed inventory', () => {
    render(
      <ProductItem
        item={{ ...baseProduct, stock: 12, stock_quantity: 12 }}
        currencySymbol="₦"
        onPress={vi.fn()}
      />
    );

    expect(screen.getByText('In stock: 12')).toBeInTheDocument();
  });

  it('does not render raw zero when compare_at_price is zero', () => {
    render(
      <ProductItem
        item={{ ...baseProduct, compare_at_price: 0 }}
        currencySymbol="₦"
        onPress={vi.fn()}
      />
    );

    expect(screen.queryByText('₦0')).not.toBeInTheDocument();
  });
});
