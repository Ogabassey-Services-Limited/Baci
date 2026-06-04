import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import type { TransactionReviewItem } from '@/hooks/useTransactionReview';
import { CostPriceEditorFields } from './CostPriceEditorFields';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,    
    Platform: { OS: 'ios' },
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      disabled?: boolean;
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          disabled,
          onClick: () => onPress?.(),
          role: accessibilityRole,
        },
        children
      ),
    StyleSheet: {
      create: <T,>(styles: T) => styles,
    },
    Switch: ({
      accessibilityLabel,
      disabled,
      onValueChange,
      value,
    }: {
      accessibilityLabel?: string;
      disabled?: boolean;
      onValueChange?: (value: boolean) => void;
      value?: boolean;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        checked: Boolean(value),
        disabled,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onValueChange?.(event.target.checked),
        type: 'checkbox',
      }),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    TextInput: ({
      accessibilityLabel,
      editable = true,
      onChangeText,
      value,
    }: {
      accessibilityLabel?: string;
      editable?: boolean;
      onChangeText?: (value: string) => void;
      value?: string;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        disabled: !editable,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onChangeText?.(event.target.value),
        value: value ?? '',
      }),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-community/datetimepicker', async () => {
  const React = await import('react');

  return {
    default: ({
      onChange,
    }: {
      onChange: (_event: { type: string }, selectedDate?: Date) => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': 'Mock transaction date picker',
          onClick: () =>
            onChange({ type: 'set' }, new Date('2026-05-14T00:00:00.000Z')),
          type: 'button',
        },
        'Mock date picker'
      ),
  };
});

vi.mock('@/components/transactions/transactions.styles', () => ({
  styles: new Proxy(
    {},
    {
      get: (_target, property) => property,
    }
  ),
}));

const selectedItem: TransactionReviewItem = {
  costPrice: 1000,
  costSource: 'product',
  id: 'item-1',
  imeiValues: [],
  name: 'Phone',
  productId: 'product-1',
  profit: 500,
  quantity: 1,
  revenue: 1500,
  searchText: 'phone',
  serialValues: [],
  sku: null,
  supplierName: '',
  variantId: null,
};

describe('CostPriceEditorFields', () => {
  it('filters supplier suggestions and forwards field changes', () => {
    const onChangeCostPrice = vi.fn();
    const onChangeDate = vi.fn();
    const onChangeSupplier = vi.fn();

    render(
      <CostPriceEditorFields
        colors={LIGHT_COLORS}
        costPriceInput="1000"
        currencySymbol="₦"
        dateInput="2026-05-01"
        onChangeCostPrice={onChangeCostPrice}
        onChangeDate={onChangeDate}
        onChangeSupplier={onChangeSupplier}
        onChangeUpdateProductDefault={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        selectedItem={selectedItem}
        supplierInput="sup"
        supplierOptions={['Supplier One', 'Other Vendor']}
        updateProductDefault={false}
        visible
      />
    );

    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '1200' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Select supplier Supplier One' })
    );

    expect(onChangeCostPrice).toHaveBeenCalledWith('1200');
    expect(onChangeSupplier).toHaveBeenCalledWith('Supplier One');
    expect(screen.queryByText('Other Vendor')).not.toBeInTheDocument();
  });

  it('emits a formatted date from the date picker', () => {
    const onChangeDate = vi.fn();

    render(
      <CostPriceEditorFields
        colors={LIGHT_COLORS}
        costPriceInput=""
        currencySymbol="₦"
        dateInput="2026-05-01"
        onChangeCostPrice={vi.fn()}
        onChangeDate={onChangeDate}
        onChangeSupplier={vi.fn()}
        onChangeUpdateProductDefault={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        selectedItem={selectedItem}
        supplierInput=""
        supplierOptions={[]}
        updateProductDefault={false}
        visible
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: 'Open transaction date picker' })
    );
    fireEvent.click(
      screen.getByRole('button', { name: 'Mock transaction date picker' })
    );

    expect(onChangeDate).toHaveBeenCalledWith('2026-05-14');
  });
});
