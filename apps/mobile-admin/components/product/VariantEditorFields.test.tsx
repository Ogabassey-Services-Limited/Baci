import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { VariantEditorFields } from './VariantEditorFields';

vi.mock('./VariantConditionEditor', () => ({
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
    />
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

vi.mock('./VariantAttributesEditor', () => ({
  VariantAttributesEditor: ({
    onAddAttribute,
    onRemoveAttribute,
    onUpdateAttribute,
  }: {
    onAddAttribute: () => void;
    onRemoveAttribute: (attributeIndex: number) => void;
    onUpdateAttribute: (
      attributeIndex: number,
      field: 'key' | 'value',
      value: string
    ) => void;
  }) => (
    <div>
      <button aria-label="Add attribute" onClick={onAddAttribute} type="button" />
      <button
        aria-label="Remove attribute 1"
        onClick={() => onRemoveAttribute(0)}
        type="button"
      />
      <button
        aria-label="Set attribute 1 key"
        onClick={() => onUpdateAttribute(0, 'key', 'Color')}
        type="button"
      />
    </div>
  ),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
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

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('VariantEditorFields', () => {
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

  it('reports field edits, condition changes and attribute wiring', () => {
    const onAddAttribute = vi.fn();
    const onRemove = vi.fn();
    const onRemoveAttribute = vi.fn();
    const onUpdate = vi.fn();
    const onUpdateAttribute = vi.fn();
    const onUpdateCondition = vi.fn();

    render(
      <VariantEditorFields
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

    fireEvent.change(screen.getByLabelText('SKU for variant 1'), {
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
    fireEvent.click(
      screen.getByRole('button', { name: 'Set variant condition' })
    );
    fireEvent.click(screen.getByRole('button', { name: 'Add attribute' }));
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove attribute 1' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Set attribute 1 key' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Remove variant 1' })
    );

    expect(onUpdate).toHaveBeenCalledWith({ sku: 'SKU-2' });
    expect(onUpdate).toHaveBeenCalledWith({ price: 1250 });
    expect(onUpdate).toHaveBeenCalledWith({ cost_price: 1000 });
    expect(onUpdate).toHaveBeenCalledWith({ stock_quantity: 4 });
    expect(onUpdateCondition).toHaveBeenCalledWith('used');
    expect(onAddAttribute).toHaveBeenCalledTimes(1);
    expect(onRemoveAttribute).toHaveBeenCalledWith(0);
    expect(onUpdateAttribute).toHaveBeenCalledWith(0, 'key', 'Color');
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it('clamps a negative or invalid stock quantity to zero', () => {
    const onUpdate = vi.fn();

    render(
      <VariantEditorFields
        colors={colors}
        currencySymbol="₦"
        onAddAttribute={vi.fn()}
        onRemove={vi.fn()}
        onRemoveAttribute={vi.fn()}
        onUpdate={onUpdate}
        onUpdateAttribute={vi.fn()}
        onUpdateCondition={vi.fn()}
        variant={variant}
        variantIndex={0}
      />
    );

    fireEvent.change(screen.getByLabelText('Stock quantity for variant 1'), {
      target: { value: 'abc' },
    });

    expect(onUpdate).toHaveBeenCalledWith({ stock_quantity: 0 });
  });

  it('labels fields for a later variant index using 1-based numbering', () => {
    render(
      <VariantEditorFields
        colors={colors}
        currencySymbol="₦"
        onAddAttribute={vi.fn()}
        onRemove={vi.fn()}
        onRemoveAttribute={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateAttribute={vi.fn()}
        onUpdateCondition={vi.fn()}
        variant={variant}
        variantIndex={3}
      />
    );

    expect(screen.getByLabelText('SKU for variant 4')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Remove variant 4' })
    ).toBeInTheDocument();
  });

  it('does not render an "apply to similar" chip when the prop is absent', () => {
    render(
      <VariantEditorFields
        colors={colors}
        currencySymbol="₦"
        onAddAttribute={vi.fn()}
        onRemove={vi.fn()}
        onRemoveAttribute={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateAttribute={vi.fn()}
        onUpdateCondition={vi.fn()}
        variant={variant}
        variantIndex={0}
      />
    );

    expect(
      screen.queryByRole('button', { name: /Apply this price/ })
    ).not.toBeInTheDocument();
  });

  it('renders an "apply to similar" chip and calls onApply when pressed', () => {
    const onApply = vi.fn();

    render(
      <VariantEditorFields
        applyToSimilar={{ count: 4, onApply }}
        colors={colors}
        currencySymbol="₦"
        onAddAttribute={vi.fn()}
        onRemove={vi.fn()}
        onRemoveAttribute={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateAttribute={vi.fn()}
        onUpdateCondition={vi.fn()}
        variant={variant}
        variantIndex={0}
      />
    );

    const applyButton = screen.getByRole('button', {
      name: 'Apply this price to 4 similar variants',
    });
    fireEvent.click(applyButton);

    expect(onApply).toHaveBeenCalledTimes(1);
  });

  it('uses the singular "variant" label when only one similar variant matches', () => {
    render(
      <VariantEditorFields
        applyToSimilar={{ count: 1, onApply: vi.fn() }}
        colors={colors}
        currencySymbol="₦"
        onAddAttribute={vi.fn()}
        onRemove={vi.fn()}
        onRemoveAttribute={vi.fn()}
        onUpdate={vi.fn()}
        onUpdateAttribute={vi.fn()}
        onUpdateCondition={vi.fn()}
        variant={variant}
        variantIndex={0}
      />
    );

    // Both the accessible name and the visible text singularize at count 1.
    const applyButton = screen.getByRole('button', {
      name: 'Apply this price to 1 similar variant',
    });
    expect(applyButton.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Apply this price to 1 similar variant'
    );
  });
});
