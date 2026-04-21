import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { ProductVariantRow } from './ProductVariantRow';

vi.mock('@/app/(admin)/product/VariantConditionEditor', () => ({
  VariantConditionEditor: ({
    updateVariantCondition,
    variantIndex,
  }: {
    updateVariantCondition: (index: number, condition?: 'used') => void;
    variantIndex: number;
  }) => (
    <button
      aria-label="Set variant condition"
      onClick={() => updateVariantCondition(variantIndex, 'used')}
      type="button"
    >
      Set condition
    </button>
  ),
}));

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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      onChangeText,
      placeholder,
      value,
    }: {
      accessibilityLabel?: string;
      onChangeText?: (value: string) => void;
      placeholder?: string;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel ?? placeholder,
        placeholder,
        value: value ?? '',
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
      }),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

describe('ProductVariantRow', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    text: '#0f172a',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  const variant: EditableProductVariant = {
    attributes: [{ id: 'attribute-1', key: 'Storage', value: '256GB' }],
    client_id: 'variant-1',
    condition: 'new',
    cost_price: 500,
    images: [],
    price: 1000,
    primary_image: null,
    sku: 'SKU-1',
    stock_quantity: 2,
  };

  it('reports field edits and row actions', () => {
    const onAddAttribute = vi.fn();
    const onRemove = vi.fn();
    const onRemoveAttribute = vi.fn();
    const onUpdate = vi.fn();
    const onUpdateAttribute = vi.fn();
    const onUpdateCondition = vi.fn();

    render(
      <ProductVariantRow
        colors={colors}
        currencySymbol="₦"
        onAddAttribute={onAddAttribute}
        onRemove={onRemove}
        onRemoveAttribute={onRemoveAttribute}
        onUpdate={onUpdate}
        onUpdateAttribute={onUpdateAttribute}
        onUpdateCondition={onUpdateCondition}
        variant={variant}
        variantIndex={0}
      />
    );

    fireEvent.change(screen.getByDisplayValue('SKU-1'), {
      target: { value: 'SKU-2' },
    });
    fireEvent.change(screen.getByLabelText('Selling price for variant 1'), {
      target: { value: '1250' },
    });
    fireEvent.change(screen.getByLabelText('Cost price for variant 1'), {
      target: { value: '1000' },
    });
    fireEvent.change(screen.getByLabelText('Stock quantity for variant 1'), {
      target: { value: '4' },
    });
    fireEvent.change(
      screen.getByLabelText('Attribute key for variant 1 item 1'),
      {
        target: { value: 'Color' },
      }
    );
    fireEvent.change(
      screen.getByLabelText('Attribute value for variant 1 item 1'),
      {
        target: { value: 'Black' },
      }
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Set variant condition' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Remove variant 1 attribute 1',
      })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(onUpdate).toHaveBeenCalledWith({ sku: 'SKU-2' });
    expect(onUpdate).toHaveBeenCalledWith({ price: 1250 });
    expect(onUpdate).toHaveBeenCalledWith({ cost_price: 1000 });
    expect(onUpdate).toHaveBeenCalledWith({ stock_quantity: 4 });
    expect(onUpdateAttribute).toHaveBeenCalledWith(0, 'key', 'Color');
    expect(onUpdateAttribute).toHaveBeenCalledWith(0, 'value', 'Black');
    expect(onUpdateCondition).toHaveBeenCalledWith('used');
    expect(onAddAttribute).toHaveBeenCalledTimes(1);
    expect(onRemoveAttribute).toHaveBeenCalledWith(0);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
