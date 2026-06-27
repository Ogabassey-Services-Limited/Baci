import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { AdminProductVariant } from '@/lib/product-picker-variant-rows';
import { ProductVariantOptionSelector } from './ProductVariantOptionSelector';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityState?: { disabled?: boolean; selected?: boolean };
      children?: ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-disabled': disabled || accessibilityState?.disabled,
          'aria-label': accessibilityLabel,
          'aria-pressed': accessibilityState?.selected,
          disabled,
          onClick: () => {
            if (!(disabled || accessibilityState?.disabled)) {
              onPress?.();
            }
          },
          type: 'button',
        },
        children
      ),
    ScrollView: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: ReactNode }) =>
      React.createElement('div', null, children),
  };
});

const colors = {
  backgroundLight: '#f8fafc',
  border: '#e2e8f0',
  card: '#ffffff',
  error: '#dc2626',
  primary: '#2563eb',
  text: '#0f172a',
  textMuted: '#94a3b8',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
};

function variant(
  id: string,
  attributes: Record<string, string>,
  overrides: Partial<AdminProductVariant> = {}
): AdminProductVariant {
  return {
    condition: 'new',
    cost_price: null,
    has_variants: false,
    id,
    images: [],
    name: `Samsung S26 ${id}`,
    parent_product_id: 'product-1',
    price: 1000,
    primary_image: null,
    sku: id.toUpperCase(),
    source: 'structured',
    stock_quantity: 1,
    variant_attributes: attributes,
    ...overrides,
  };
}

describe('ProductVariantOptionSelector', () => {
  it('lets the user tap options until a valid variant can be added', () => {
    const onAddProduct = vi.fn();
    const variants = [
      variant('variant-1', {
        color: 'Black',
        ram: '12GB',
        storage: '256GB',
      }),
      variant('variant-2', {
        color: 'Blue',
        ram: '12GB',
        storage: '512GB',
      }),
    ];

    render(
      <ProductVariantOptionSelector
        colors={colors}
        formatPrice={(amount) => `₦${amount}`}
        onAddProduct={onAddProduct}
        parentProduct={{
          condition: 'new',
          has_variants: true,
          id: 'product-1',
          images: ['https://example.test/parent.jpg'],
          name: 'Samsung Galaxy S26',
          parent_product_id: null,
          price: 1000,
          sku: null,
          variant_attributes: [],
        }}
        variants={variants}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Add selected variant' })
    ).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Select Color Blue' }));

    expect(
      screen.getByRole('button', { name: 'Select Storage 256GB' })
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'Add selected variant' })
    ).not.toBeDisabled();

    fireEvent.click(
      screen.getByRole('button', { name: 'Add selected variant' })
    );

    expect(onAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-2',
        images: ['https://example.test/parent.jpg'],
      })
    );
  });

  it('uses an empty image array when selected and parent products have no images', () => {
    const onAddProduct = vi.fn();

    render(
      <ProductVariantOptionSelector
        colors={colors}
        formatPrice={(amount) => `₦${amount}`}
        onAddProduct={onAddProduct}
        parentProduct={{
          condition: 'new',
          has_variants: true,
          id: 'product-1',
          images: undefined as unknown as string[],
          name: 'Samsung Galaxy S26',
          parent_product_id: null,
          price: 1000,
          sku: null,
          variant_attributes: [],
        }}
        variants={[
          variant('variant-1', {
            color: 'Black',
            storage: '256GB',
          }),
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add selected variant' })
    );

    expect(onAddProduct).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'variant-1',
        images: [],
      })
    );
  });

  it('lets users clear a selected option after refreshed variants make it unavailable', () => {
    const parentProduct = {
      condition: 'new',
      has_variants: true,
      id: 'product-1',
      images: [],
      name: 'Samsung Galaxy S26',
      parent_product_id: null,
      price: 1000,
      sku: null,
      variant_attributes: [],
    };
    const { rerender } = render(
      <ProductVariantOptionSelector
        colors={colors}
        formatPrice={(amount) => `₦${amount}`}
        onAddProduct={vi.fn()}
        parentProduct={parentProduct}
        variants={[
          variant('variant-1', { color: 'Blue', storage: '256GB' }),
          variant('variant-2', { color: 'Blue', storage: '512GB' }),
        ]}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Select Storage 256GB' })
    );
    rerender(
      <ProductVariantOptionSelector
        colors={colors}
        formatPrice={(amount) => `₦${amount}`}
        onAddProduct={vi.fn()}
        parentProduct={parentProduct}
        variants={[
          variant('variant-2', { color: 'Blue', storage: '512GB' }),
          variant('variant-3', { color: 'Black', storage: '256GB' }),
        ]}
      />
    );

    const staleStorage = screen.getByRole('button', {
      name: 'Select Storage 256GB',
    });

    expect(staleStorage).not.toBeDisabled();
    fireEvent.click(staleStorage);
    expect(
      screen.getByRole('button', { name: 'Select Storage 256GB' })
    ).toHaveAttribute('aria-pressed', 'false');
  });
});
