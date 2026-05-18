import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { CostPriceEditorModal } from './CostPriceEditorModal';

const platformMock = vi.hoisted(() => ({
  OS: 'ios' as 'android' | 'ios',
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    ActivityIndicator: () =>
      React.createElement('div', { role: 'progressbar' }),
    Platform: platformMock,
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
      onChange: (_event: unknown, selectedDate?: Date) => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': 'Mock transaction date picker',
          onClick: () =>
            onChange(
              { type: 'set' },
              new Date('2026-05-14T00:00:00.000Z')
            ),
          type: 'button',
        },
        'Mock date picker'
      ),
  };
});

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
  };
});

vi.mock('@/components/ui/BottomSheetModal', () => ({
  BottomSheetModal: ({
    children,
    visible,
  }: {
    children?: React.ReactNode;
    visible: boolean;
  }) => (visible ? <div>{children}</div> : null),
}));

vi.mock('@/components/transactions/transactions.styles', () => ({
  styles: new Proxy(
    {},
    {
      get: (_target, property) => property,
    }
  ),
}));

const selectedItem = {
  costPrice: 1000,
  id: 'item-1',
  imeiValues: [],
  name: 'Samsung Galaxy S26',
  productId: 'product-1',
  profit: 500,
  quantity: 1,
  revenue: 1500,
  searchText: 'samsung',
  serialValues: [],
  sku: null,
  supplierName: '',
};

describe('CostPriceEditorModal', () => {
  beforeEach(() => {
    platformMock.OS = 'ios';
  });

  it('edits cost price, transaction date, and vendor or supplier values', () => {
    const onChangeCostPrice = vi.fn();
    const onChangeDate = vi.fn();
    const onChangeSupplier = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={onChangeCostPrice}
        onChangeDate={onChangeDate}
        onChangeSupplier={onChangeSupplier}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={['Slot wholesale']}
        supplierInput="Slot Wholesale"
        visible
      />
    );

    fireEvent.change(screen.getByLabelText('Cost price input'), {
      target: { value: '1200' },
    });
    fireEvent.change(screen.getByLabelText('Transaction date input'), {
      target: { value: '2026-05-13' },
    });
    fireEvent.change(screen.getByLabelText('Vendor or supplier input'), {
      target: { value: 'Main Supplier' },
    });

    expect(onChangeCostPrice).toHaveBeenCalledWith('1200');
    expect(onChangeDate).toHaveBeenCalledWith('2026-05-13');
    expect(onChangeSupplier).toHaveBeenCalledWith('Main Supplier');
  });

  it('opens the transaction date picker and applies the selected date', () => {
    const onChangeDate = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={onChangeDate}
        onChangeSupplier={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput=""
        visible
      />
    );

    fireEvent.click(screen.getByLabelText('Open transaction date picker'));
    fireEvent.click(screen.getByLabelText('Mock transaction date picker'));

    expect(onChangeDate).toHaveBeenCalledWith('2026-05-14');
  });

  it('dismisses the transaction date picker after Android date selection', async () => {
    platformMock.OS = 'android';
    const onChangeDate = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={onChangeDate}
        onChangeSupplier={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput=""
        visible
      />
    );

    fireEvent.click(screen.getByLabelText('Open transaction date picker'));
    fireEvent.click(screen.getByLabelText('Mock transaction date picker'));

    expect(onChangeDate).toHaveBeenCalledWith('2026-05-14');
    await waitFor(() =>
      expect(
        screen.queryByLabelText('Mock transaction date picker')
      ).not.toBeInTheDocument()
    );
  });

  it('resets the transaction date picker after closing and reopening', () => {
    const props = {
      colors: LIGHT_COLORS,
      costPriceInput: '₦1,000',
      currencySymbol: '₦',
      dateInput: '2026-05-12',
      onChangeCostPrice: vi.fn(),
      onChangeDate: vi.fn(),
      onChangeSupplier: vi.fn(),
      onClose: vi.fn(),
      onSave: vi.fn(),
      pending: false,
      saveError: null,
      selectedItem,
      supplierOptions: [],
      supplierInput: '',
      visible: true,
    };

    const { rerender } = render(<CostPriceEditorModal {...props} />);

    fireEvent.click(screen.getByLabelText('Open transaction date picker'));
    expect(screen.getByLabelText('Mock transaction date picker')).toBeInTheDocument();

    rerender(<CostPriceEditorModal {...props} visible={false} />);
    rerender(<CostPriceEditorModal {...props} visible />);

    expect(
      screen.queryByLabelText('Mock transaction date picker')
    ).not.toBeInTheDocument();
  });

  it('shows matching previous supplier options while typing', () => {
    const onChangeSupplier = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={onChangeSupplier}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={['Slot wholesale', 'Main supplier']}
        supplierInput="sl"
        visible
      />
    );

    fireEvent.click(
      screen.getByRole('button', { name: /select supplier slot wholesale/i })
    );

    expect(onChangeSupplier).toHaveBeenCalledWith('Slot wholesale');
    expect(screen.queryByText('Main supplier')).not.toBeInTheDocument();
  });

  it('disables supplier suggestions while pending', () => {
    const onChangeSupplier = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={onChangeSupplier}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={['Slot wholesale']}
        supplierInput="sl"
        visible
      />
    );

    const suggestion = screen.getByRole('button', {
      name: /select supplier slot wholesale/i,
    });

    expect(suggestion).toBeDisabled();
    fireEvent.click(suggestion);
    expect(onChangeSupplier).not.toHaveBeenCalled();
  });

  it('saves and cancels from the action buttons', () => {
    const onClose = vi.fn();
    const onSave = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={vi.fn()}
        onClose={onClose}
        onSave={onSave}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput="Slot Wholesale"
        visible
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /save cost price/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel cost price/i }));

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes from the top-right close button', () => {
    const onClose = vi.fn();

    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={vi.fn()}
        onClose={onClose}
        onSave={vi.fn()}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput="Slot Wholesale"
        visible
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /close editor/i }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('renders save errors', () => {
    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        saveError="Could not save"
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput="Slot Wholesale"
        visible
      />
    );

    expect(screen.getByText('Could not save')).toBeInTheDocument();
  });

  it('disables inputs and save action while pending', () => {
    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput="Slot Wholesale"
        visible
      />
    );

    expect(screen.getByLabelText('Cost price input')).toBeDisabled();
    expect(screen.getByLabelText('Transaction date input')).toBeDisabled();
    expect(screen.getByLabelText('Vendor or supplier input')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /save cost price/i })
    ).toBeDisabled();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('does not render modal content when hidden', () => {
    render(
      <CostPriceEditorModal
        colors={LIGHT_COLORS}
        costPriceInput="₦1,000"
        currencySymbol="₦"
        dateInput="2026-05-12"
        onChangeCostPrice={vi.fn()}
        onChangeDate={vi.fn()}
        onChangeSupplier={vi.fn()}
        onClose={vi.fn()}
        onSave={vi.fn()}
        pending={false}
        saveError={null}
        selectedItem={selectedItem}
        supplierOptions={[]}
        supplierInput="Slot Wholesale"
        visible={false}
      />
    );

    expect(screen.queryByText('Update transaction')).not.toBeInTheDocument();
  });
});
