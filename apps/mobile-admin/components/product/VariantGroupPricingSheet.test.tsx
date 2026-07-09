import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import type { VariantPricingUpdate } from '@/lib/variant-group-pricing';
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
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
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

describe('VariantGroupPricingSheet', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    primary: '#2563eb',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  // 2 storages x 2 colours, all sharing the same condition.
  const variants: EditableProductVariant[] = [
    buildVariant('v1', 'Black', '64GB', 400_000), // index 0
    buildVariant('v2', 'Blue', '64GB', 400_000), // index 1
    buildVariant('v3', 'Black', '128GB', 450_000), // index 2
    buildVariant('v4', 'Blue', '128GB', 450_000), // index 3
  ];

  it('varies price by condition and storage by default, excluding no-op condition controls', () => {
    render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={variants}
        visible={true}
      />
    );

    expect(
      screen.queryByRole('checkbox', { name: 'Price varies by Condition' })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Price varies by Storage' })
    ).toBeChecked();
    expect(
      screen.getByRole('checkbox', { name: 'Price varies by Color' })
    ).not.toBeChecked();
  });

  it('renders one row per condition and storage combination', () => {
    render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={variants}
        visible={true}
      />
    );

    expect(
      screen.getByLabelText('Selling price for Used · 64GB')
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Selling price for Used · 128GB')
    ).toBeInTheDocument();
    expect(screen.getAllByText('2 variants')).toHaveLength(2);
  });

  it('starts with the apply action disabled until a price is edited', () => {
    render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={variants}
        visible={true}
      />
    );

    expect(screen.getByText('Edit a price to apply')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Apply prices' })).toBeDisabled();
  });

  it('applies an edited price to every variant in the group and closes the sheet', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();

    render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={onApply}
        onClose={onClose}
        variants={variants}
        visible={true}
      />
    );

    fireEvent.change(screen.getByLabelText('Selling price for Used · 128GB'), {
      target: { value: '500000' },
    });

    expect(screen.getByText('Apply to 2 variants')).toBeInTheDocument();
    const applyButton = screen.getByRole('button', {
      name: 'Apply prices to 2 variants',
    });
    expect(applyButton).not.toBeDisabled();

    fireEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledTimes(1);
    const updates = onApply.mock.calls[0]?.[0] as VariantPricingUpdate[];
    expect(updates).toHaveLength(1);
    expect(updates[0]?.indexes).toEqual([2, 3]);
    expect(updates).toEqual([
      { cost_price: undefined, indexes: [2, 3], price: 500_000 },
    ]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('resets pending edits and regroups rows when an axis is toggled off', () => {
    render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={variants}
        visible={true}
      />
    );

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

  it('shows a "Mixed" placeholder when a group has disagreeing prices', () => {
    const mixedVariants: EditableProductVariant[] = [
      buildVariant('v1', 'Black', '64GB', 400_000),
      buildVariant('v2', 'Blue', '64GB', 420_000),
      buildVariant('v3', 'Black', '128GB', 450_000),
      buildVariant('v4', 'Blue', '128GB', 450_000),
    ];

    render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={mixedVariants}
        visible={true}
      />
    );

    expect(
      screen.getByLabelText('Selling price for Used · 64GB')
    ).toHaveAttribute('placeholder', 'Mixed');
    expect(screen.getByLabelText('Selling price for Used · 64GB')).toHaveValue(
      ''
    );
    expect(
      screen.getByLabelText('Selling price for Used · 128GB')
    ).toHaveAttribute('placeholder', '0.00');
  });

  it('refreshes selected pricing axes when reopened for a new variant set', () => {
    const { rerender } = render(
      <VariantGroupPricingSheet
        colors={colors}
        currencySymbol="₦"
        onApply={vi.fn()}
        onClose={vi.fn()}
        variants={variants}
        visible={true}
      />
    );

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
        visible={false}
      />
    );
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
});
