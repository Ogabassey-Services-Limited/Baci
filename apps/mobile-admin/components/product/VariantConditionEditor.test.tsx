import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { EditableProductCondition } from '@/lib/product-condition';
import type { EditableProductVariant } from '@/lib/product-variant-form';
import { VariantConditionEditor } from './VariantConditionEditor';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      accessibilityState,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      accessibilityState?: { checked?: boolean };
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-checked': accessibilityState?.checked,
          'aria-label': accessibilityLabel,
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

const colors = {
  border: '#e2e8f0',
  card: '#ffffff',
  primary: '#2563eb',
  text: '#0f172a',
  textOnPrimary: '#ffffff',
  textSecondary: '#64748b',
};

const conditionOptions: readonly EditableProductCondition[] = [
  'new',
  'open_box',
  'used',
];

const conditionLabels: Record<EditableProductCondition, string> = {
  new: 'New',
  open_box: 'Open Box',
  used: 'Used',
};

function createVariant(
  condition?: EditableProductCondition
): EditableProductVariant {
  return {
    attributes: [],
    client_id: 'variant-1',
    condition,
    cost_price: 0,
    images: [],
    price: 0,
    primary_image: null,
    sku: 'SKU-1',
    stock_quantity: 0,
  };
}

describe('VariantConditionEditor', () => {
  it('renders formatted condition labels and updates the selected condition', () => {
    const updateVariantCondition = vi.fn();
    const formatConditionLabel = vi.fn(
      (condition?: string | null) =>
        conditionLabels[condition as EditableProductCondition] ?? null
    );

    render(
      <VariantConditionEditor
        colors={colors}
        conditionOptions={conditionOptions}
        formatConditionLabel={formatConditionLabel}
        updateVariantCondition={updateVariantCondition}
        variant={createVariant('open_box')}
        variantIndex={2}
      />
    );

    expect(screen.getByText('New')).toBeTruthy();
    expect(screen.getByText('Open Box')).toBeTruthy();
    expect(screen.getByText('Used')).toBeTruthy();

    const newOption = screen.getByRole('radio', { name: 'New condition' });
    const openBoxOption = screen.getByRole('radio', {
      name: 'Open Box condition',
    });

    expect(newOption).not.toBeChecked();
    expect(openBoxOption).toBeChecked();

    fireEvent.click(screen.getByRole('radio', { name: 'Used condition' }));

    expect(updateVariantCondition).toHaveBeenCalledWith(2, 'used');
    expect(formatConditionLabel).toHaveBeenCalledWith('new');
    expect(formatConditionLabel).toHaveBeenCalledWith('open_box');
    expect(formatConditionLabel).toHaveBeenCalledWith('used');
  });

  it('clears the selected condition when requested', () => {
    const updateVariantCondition = vi.fn();

    render(
      <VariantConditionEditor
        colors={colors}
        conditionOptions={conditionOptions}
        formatConditionLabel={(condition) =>
          conditionLabels[condition as EditableProductCondition] ?? null
        }
        updateVariantCondition={updateVariantCondition}
        variant={createVariant('used')}
        variantIndex={1}
      />
    );

    const clearButton = screen.getByRole('button', {
      name: 'Clear selected condition',
    });

    expect(screen.getByText('Clear')).toBeTruthy();

    fireEvent.click(clearButton);

    expect(updateVariantCondition).toHaveBeenCalledWith(1, undefined);
  });

  it('hides the clear action when no condition is selected', () => {
    render(
      <VariantConditionEditor
        colors={colors}
        conditionOptions={conditionOptions}
        formatConditionLabel={(condition) =>
          conditionLabels[condition as EditableProductCondition] ?? null
        }
        updateVariantCondition={vi.fn()}
        variant={createVariant()}
        variantIndex={0}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Clear selected condition' })
    ).toBeNull();
  });
});
