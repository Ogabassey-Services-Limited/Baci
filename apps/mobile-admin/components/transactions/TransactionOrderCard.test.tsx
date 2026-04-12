import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import { TransactionOrderCard } from './TransactionOrderCard';

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
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
          role: accessibilityRole,
          onClick: () => onPress?.(),
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', async () => {
  const React = await import('react');

  return {
    Ionicons: ({ name }: { name: string }) =>
      React.createElement('span', null, name),
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

const editableItem = {
  costPrice: 1200,
  id: 'item-1',
  name: 'Samsung Galaxy S26',
  productId: 'product-1',
  profit: 3400,
  quantity: 1,
  revenue: 4600,
};

const nonEditableItem = {
  costPrice: null,
  id: 'item-2',
  name: 'Manual adjustment',
  productId: null,
  profit: null,
  quantity: 1,
  revenue: 500,
};

describe('TransactionOrderCard', () => {
  it('opens the editor for editable product-linked rows', () => {
    const onOpenEditor = vi.fn();

    render(
      <TransactionOrderCard
        colors={LIGHT_COLORS}
        formatCurrency={(amount) => `NGN ${amount}`}
        onOpenEditor={onOpenEditor}
        order={{
          createdAt: '2026-04-11T09:00:00.000Z',
          customerName: 'Bassey',
          estimatedProfit: 3400,
          id: 'order-1',
          items: [editableItem],
          missingCostCount: 0,
          orderNumber: 'ORD-1',
          paymentMethod: 'card',
          total: 4600,
        }}
      />
    );

    const row = screen.getByRole('button', {
      name: /Samsung Galaxy S26, 1 units, revenue NGN 4600/i,
    });

    expect(screen.getByText('create-outline')).toBeInTheDocument();

    fireEvent.click(row);
    expect(onOpenEditor).toHaveBeenCalledWith(editableItem);
  });

  it('renders non-product rows as disabled and without the edit icon', () => {
    const onOpenEditor = vi.fn();

    render(
      <TransactionOrderCard
        colors={LIGHT_COLORS}
        formatCurrency={(amount) => `NGN ${amount}`}
        onOpenEditor={onOpenEditor}
        order={{
          createdAt: '2026-04-11T09:00:00.000Z',
          customerName: 'Bassey',
          estimatedProfit: 0,
          id: 'order-1',
          items: [nonEditableItem],
          missingCostCount: 1,
          orderNumber: 'ORD-1',
          paymentMethod: 'card',
          total: 500,
        }}
      />
    );

    const row = screen.getByRole('button', {
      name: /Manual adjustment, 1 units, revenue NGN 500/i,
    });

    expect(row).toBeDisabled();
    expect(screen.queryByText('create-outline')).not.toBeInTheDocument();
    fireEvent.click(row);
    expect(onOpenEditor).not.toHaveBeenCalled();
  });
});
