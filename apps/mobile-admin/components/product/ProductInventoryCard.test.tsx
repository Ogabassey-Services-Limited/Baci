import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { ProductInventoryCard } from './ProductInventoryCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    StatusBar: () => null,
    Pressable: ({
      accessibilityLabel,
      children,
      disabled,
      onPress,
    }: {
      accessibilityLabel?: string;
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
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Switch: ({
      accessibilityLabel,
      onValueChange,
      value,
    }: {
      accessibilityLabel?: string;
      onValueChange?: (value: boolean) => void;
      value?: boolean;
    }) =>
      React.createElement('input', {
        'aria-label': accessibilityLabel,
        checked: value ?? false,
        onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
          onValueChange?.(event.target.checked),
        type: 'checkbox',
      }),
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
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

describe('ProductInventoryCard', () => {
  const colors = {
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    inputBg: '#f8fafc',
    primary: '#2563eb',
    success: '#16a34a',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as unknown as ThemeColors;

  it('updates stock quantity, threshold, and stock action buttons when inventory tracking is enabled', () => {
    const onLowStockThresholdChange = vi.fn();
    const onOpenFulfillmentModal = vi.fn();
    const onStockAdjust = vi.fn();
    const onToggleManageStock = vi.fn();

    render(
      <ProductInventoryCard
        colors={colors}
        fulfillmentCount={2}
        lowStockThreshold={3}
        manageStock={true}
        onLowStockThresholdChange={onLowStockThresholdChange}
        onOpenFulfillmentModal={onOpenFulfillmentModal}
        onStockAdjust={onStockAdjust}
        onToggleManageStock={onToggleManageStock}
        stockQuantity={1}
      />
    );

    const unlimitedStockSwitch = screen.getByRole('checkbox', {
      name: 'Set unlimited stock',
    });
    expect(unlimitedStockSwitch).not.toBeChecked();
    fireEvent.click(unlimitedStockSwitch);
    fireEvent.click(
      screen.getByRole('button', { name: 'Open fulfillment details' })
    );
    fireEvent.change(screen.getByRole('textbox', { name: 'Stock quantity' }), {
      target: { value: '12' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Decrease stock' }));
    fireEvent.click(screen.getByRole('button', { name: 'Increase stock' }));
    fireEvent.change(
      screen.getByRole('textbox', { name: 'Low stock threshold' }),
      {
        target: { value: '5' },
      }
    );

    expect(onToggleManageStock).toHaveBeenCalledWith(false);
    expect(onOpenFulfillmentModal).toHaveBeenCalledTimes(1);
    expect(onStockAdjust).toHaveBeenCalledWith(12);
    expect(onStockAdjust).toHaveBeenCalledWith(0);
    expect(onStockAdjust).toHaveBeenCalledWith(2);
    expect(onLowStockThresholdChange).toHaveBeenCalledWith(5);
  });

  it('hides stock controls when inventory tracking is disabled', () => {
    render(
      <ProductInventoryCard
        colors={colors}
        fulfillmentCount={0}
        lowStockThreshold={3}
        manageStock={false}
        onLowStockThresholdChange={vi.fn()}
        onOpenFulfillmentModal={vi.fn()}
        onStockAdjust={vi.fn()}
        onToggleManageStock={vi.fn()}
        stockQuantity={1}
      />
    );

    expect(screen.getByText('Set unlimited stock')).toBeInTheDocument();
    expect(
      screen.getByRole('checkbox', { name: 'Set unlimited stock' })
    ).toBeChecked();
    expect(
      screen.queryByRole('button', { name: 'Open fulfillment details' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Decrease stock' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Increase stock' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Stock Management')).not.toBeInTheDocument();
    expect(screen.queryByText('Low Stock Threshold')).not.toBeInTheDocument();
  });

  it('renders serialized layout when tracking policy is serialized_strict', () => {
    const onOpenRestockModal = vi.fn();
    const onOpenUnitsModal = vi.fn();

    render(
      <ProductInventoryCard
        colors={colors}
        fulfillmentCount={0}
        lowStockThreshold={3}
        manageStock={true}
        onLowStockThresholdChange={vi.fn()}
        onOpenFulfillmentModal={vi.fn()}
        onStockAdjust={vi.fn()}
        onToggleManageStock={vi.fn()}
        stockQuantity={15}
        inventoryTrackingPolicy="serialized_strict"
        onOpenRestockModal={onOpenRestockModal}
        onOpenUnitsModal={onOpenUnitsModal}
      />
    );

    // Title should be Serialized Inventory
    expect(screen.getByText('Serialized Inventory')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Track stock via individual IMEI or Serial Number units.'
      )
    ).toBeInTheDocument();

    // Stock count should be displayed as read-only available
    expect(screen.getByText('15 Available')).toBeInTheDocument();
    expect(screen.getByText('Tracked units in stock')).toBeInTheDocument();

    // Restock and View Units buttons should be shown and trigger actions
    const restockButton = screen.getByRole('button', {
      name: 'Open restock sheet',
    });
    const unitsButton = screen.getByRole('button', {
      name: 'Open view edit units sheet',
    });

    expect(restockButton).toBeInTheDocument();
    expect(unitsButton).toBeInTheDocument();

    fireEvent.click(restockButton);
    expect(onOpenRestockModal).toHaveBeenCalledTimes(1);

    fireEvent.click(unitsButton);
    expect(onOpenUnitsModal).toHaveBeenCalledTimes(1);

    // Quantity should be read-only in ProductStockControls (Quantity label change + textbox hidden)
    expect(screen.getByText('Quantity (Read-only)')).toBeInTheDocument();
    expect(
      screen.queryByRole('textbox', { name: 'Stock quantity' })
    ).not.toBeInTheDocument();
  });
});
