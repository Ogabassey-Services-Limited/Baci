import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { ProductVariantsCard } from './ProductVariantsCard';

vi.mock('./PriceInput', () => ({
  PriceInput: ({
    accessibilityLabel,
    onChange,
    value,
  }: {
    accessibilityLabel: string;
    onChange: (value: number) => void;
    value: number;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChange(Number(event.target.value))}
      value={value}
    />
  ),
}));

vi.mock('./ProductVariantRow', () => ({
  ProductVariantRow: ({
    onUpdate,
    variantIndex,
  }: {
    onUpdate: (updates: { sku: string }) => void;
    variantIndex: number;
  }) => (
    <button
      aria-label={`Update variant row ${variantIndex + 1}`}
      onClick={() => onUpdate({ sku: `SKU-${variantIndex + 1}` })}
      type="button"
    >
      Update variant row {variantIndex + 1}
    </button>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('ProductVariantsCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    primary: '#2563eb',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  const variants: EditableProductVariant[] = [
    {
      attributes: [],
      client_id: 'variant-1',
      condition: 'new',
      cost_price: 500,
      images: [],
      price: 1000,
      primary_image: null,
      sku: 'SKU-1',
      stock_quantity: 2,
    },
  ];

  it('wires default price changes and variant row updates through the variant index', () => {
    const onAddVariant = vi.fn();
    const onDefaultCostPriceChange = vi.fn();
    const onDefaultPriceChange = vi.fn();
    const onUpdateVariant = vi.fn();

    render(
      <ProductVariantsCard
        colors={colors}
        currencySymbol="₦"
        hasVariantConditionAxis={true}
        onAddVariant={onAddVariant}
        onAddVariantAttribute={vi.fn()}
        onDefaultCostPriceChange={onDefaultCostPriceChange}
        onDefaultPriceChange={onDefaultPriceChange}
        onRemoveVariant={vi.fn()}
        onRemoveVariantAttribute={vi.fn()}
        onUpdateVariant={onUpdateVariant}
        onUpdateVariantAttribute={vi.fn()}
        onUpdateVariantCondition={vi.fn()}
        value={{ cost_price: 300, price: 900 }}
        variants={variants}
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Add product variant' })
    );
    fireEvent.change(screen.getByLabelText('Default selling price'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('Default cost price'), {
      target: { value: '600' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Update variant row 1' })
    );

    expect(onAddVariant).toHaveBeenCalledTimes(1);
    expect(onDefaultPriceChange).toHaveBeenCalledWith(1200);
    expect(onDefaultCostPriceChange).toHaveBeenCalledWith(600);
    expect(onUpdateVariant).toHaveBeenCalledWith(0, { sku: 'SKU-1' });
    expect(
      screen.getByText(/Condition is now part of the variant identity/i)
    ).toBeInTheDocument();
  });
});
