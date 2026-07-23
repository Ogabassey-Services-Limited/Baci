import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { VariantGroupPricingSheet } from './VariantGroupPricingSheet';

vi.mock('@/components/ui/AppPageSheet', () => ({
  AppPageSheet: ({
    children,
    footer,
  }: {
    children?: React.ReactNode;
    footer?: React.ReactNode;
  }) => (
    <div>
      <div>{children}</div>
      <div>{footer}</div>
    </div>
  ),
}));

vi.mock('./PriceInput', () => ({
  PriceInput: ({
    accessibilityLabel,
    onChange,
    placeholder,
    value,
  }: {
    accessibilityLabel: string;
    onChange: (value: number) => void;
    placeholder: string;
    value?: number;
  }) => (
    <input
      aria-label={accessibilityLabel}
      onChange={(event) => onChange(Number(event.target.value))}
      placeholder={placeholder}
      value={value ?? ''}
    />
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');
  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean; disabled?: boolean };
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-label': accessibilityLabel,
          disabled: disabled ?? accessibilityState?.disabled,
          onClick: () => onPress?.(),
          role: accessibilityRole,
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

function buildVariant(
  id: string,
  color: string,
  storage: string,
  price: number
): EditableProductVariant {
  return {
    attributes: [
      { id: `${id}-color`, key: 'Color', value: color },
      { id: `${id}-storage`, key: 'Storage', value: storage },
    ],
    client_id: id,
    condition: 'used',
    cost_price: 0,
    images: [],
    price,
    primary_image: null,
    sku: '',
    stock_quantity: 0,
  };
}

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  error: '#dc2626',
  primary: '#2563eb',
  text: '#0f172a',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
} as unknown as ThemeColors;

const variants: EditableProductVariant[] = [
  buildVariant('v1', 'Black', '64GB', 400_000),
  buildVariant('v2', 'Blue', '64GB', 400_000),
  buildVariant('v3', 'Black', '128GB', 450_000),
  buildVariant('v4', 'Blue', '128GB', 450_000),
];

function renderSheet(nextVariants = variants) {
  return render(
    <VariantGroupPricingSheet
      colors={colors}
      currencySymbol="₦"
      onApply={vi.fn()}
      onClose={vi.fn()}
      variants={nextVariants}
      visible={true}
    />
  );
}

describe('VariantGroupPricingSheet draft resets', () => {
  it('resets pending edits and regroups rows when an axis is toggled off', () => {
    renderSheet();

    fireEvent.change(screen.getByLabelText('Selling price for Used · 64GB'), {
      target: { value: '500000' },
    });
    expect(screen.getByText('Apply to 2 variants')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Price varies by Storage' })
    );

    expect(screen.getByText('Edit a price to apply')).toBeInTheDocument();
    expect(screen.getByLabelText('Selling price for Used')).toBeInTheDocument();
  });

  it('refreshes selected pricing axes when the visible variant set changes', () => {
    const { rerender } = renderSheet();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Price varies by Storage' })
    );
    expect(screen.getByLabelText('Selling price for Used')).toBeInTheDocument();

    rerender(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={[
          buildVariant('v5', 'Gold', '256GB', 600_000),
          buildVariant('v6', 'Silver', '512GB', 700_000),
        ]}
        visible={true}
      />
    );

    expect(
      screen.getByLabelText('Selling price for Used · 256GB')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Selling price for Used · 512GB')
    ).toBeInTheDocument();
  });

  it('clears drafts when visible variants are replaced with the same axes', () => {
    const { rerender } = renderSheet();

    fireEvent.change(screen.getByLabelText('Selling price for Used · 64GB'), {
      target: { value: '500000' },
    });
    expect(screen.getByText('Apply to 2 variants')).toBeInTheDocument();

    rerender(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={variants.map((variant, index) => ({
          ...variant,
          client_id: `replacement-${index}`,
        }))}
        visible={true}
      />
    );

    expect(screen.getByText('Edit a price to apply')).toBeInTheDocument();
  });

  it('preserves selected axes and drafts when the same variants are reordered', () => {
    const { rerender } = renderSheet();

    fireEvent.click(
      screen.getByRole('checkbox', { name: 'Price varies by Color' })
    );
    fireEvent.change(
      screen.getByLabelText('Selling price for Used · Black · 64GB'),
      { target: { value: '500000' } }
    );

    rerender(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={[...variants].reverse()}
        visible={true}
      />
    );

    expect(
      screen.getByRole('checkbox', { name: 'Price varies by Color' })
    ).toBeChecked();
    expect(
      screen.getByLabelText('Selling price for Used · Black · 64GB')
    ).toHaveValue('500000');
    expect(screen.getByText('Apply to 1 variant')).toBeInTheDocument();
  });
});
