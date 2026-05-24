import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { useNewOrderController } from '@/hooks/useNewOrderController';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => <span>image</span>,
}));

vi.mock('./NewOrderSummarySection', () => ({
  NewOrderSummarySection: () => <div>summary-section</div>,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      children,
      hitSlop,
      onPress,
    }: {
      accessibilityLabel?: string;
      children?: React.ReactNode;
      hitSlop?: { top: number; right: number; bottom: number; left: number };
      onPress?: () => void;
    }) =>
      React.createElement(
        'button',
        {
          'aria-label': accessibilityLabel,
          'data-hit-slop': hitSlop ? JSON.stringify(hitSlop) : undefined,
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

import { NewOrderItemsSection } from './NewOrderItemsSection';

type ItemsController = Pick<
  ReturnType<typeof useNewOrderController>,
  | 'colors'
  | 'formatPrice'
  | 'handleQuantityChange'
  | 'orderItems'
  | 'resetProductPickerState'
  | 'setEditDetails'
  | 'setEditingItem'
  | 'setEditPriceValue'
  | 'setEditQtyValue'
  | 'setProductSearch'
  | 'setShowCustomItemModal'
  | 'setShowEditItemModal'
  | 'setShowProductModal'
>;

function makeController(
  overrides: Partial<ItemsController> = {}
): ReturnType<typeof useNewOrderController> {
  return {
    colors: {
      backgroundLight: '#eef2ff',
      border: '#e2e8f0',
      card: '#ffffff',
      error: '#dc2626',
      primary: '#2563eb',
      text: '#0f172a',
      textMuted: '#94a3b8',
      textSecondary: '#64748b',
      ...overrides.colors,
    },
    formatPrice: vi.fn((value: number) => `₦${value.toFixed(2)}`),
    handleQuantityChange: vi.fn(),
    orderItems: [],
    resetProductPickerState: vi.fn(),
    setEditDetails: vi.fn(),
    setEditingItem: vi.fn(),
    setEditPriceValue: vi.fn(),
    setEditQtyValue: vi.fn(),
    setProductSearch: vi.fn(),
    setShowCustomItemModal: vi.fn(),
    setShowEditItemModal: vi.fn(),
    setShowProductModal: vi.fn(),
    ...overrides,
  } as ReturnType<typeof useNewOrderController>;
}

describe('NewOrderItemsSection', () => {
  it('shows the empty state and forwards the add/search actions', () => {
    const controller = makeController();

    render(<NewOrderItemsSection controller={controller} />);

    expect(screen.getByText('No items added yet')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Quick add item' }));
    fireEvent.click(screen.getByRole('button', { name: 'Search catalog' }));

    expect(controller.setShowCustomItemModal).toHaveBeenCalledWith(true);
    expect(controller.resetProductPickerState).toHaveBeenCalledTimes(1);
    expect(controller.setProductSearch).toHaveBeenCalledWith('');
    expect(controller.setShowProductModal).toHaveBeenCalledWith(true);
  });

  it('renders order items and wires edit and quantity actions', () => {
    const item = {
      details: 'Black / 128GB',
      id: 'item-1',
      image_url: 'https://example.com/phone.png',
      name: 'Baci Phone',
      price: 25000,
      product_id: 'product-1',
      quantity: 2,
      variant_id: null,
      variant_name: null,
    };
    const controller = makeController({ orderItems: [item] });

    render(<NewOrderItemsSection controller={controller} />);

    expect(screen.getByText('Baci Phone')).toBeInTheDocument();
    expect(screen.getByText('Black / 128GB')).toBeInTheDocument();
    expect(screen.getByText('₦25000.00')).toBeInTheDocument();
    expect(screen.getByText('summary-section')).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', { name: 'Edit item Baci Phone' })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Decrease quantity for Baci Phone, current 2',
      })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Increase quantity for Baci Phone, current 2',
      })
    );

    expect(controller.setEditingItem).toHaveBeenCalledWith(item);
    expect(controller.setEditPriceValue).toHaveBeenCalledWith('25000');
    expect(controller.setEditQtyValue).toHaveBeenCalledWith('2');
    expect(controller.setEditDetails).toHaveBeenCalledWith('Black / 128GB');
    expect(controller.setShowEditItemModal).toHaveBeenCalledWith(true);
    expect(controller.handleQuantityChange).toHaveBeenCalledWith('item-1', -1);
    expect(controller.handleQuantityChange).toHaveBeenCalledWith('item-1', 1);
  });

  it('applies a >=12px hitSlop to the quantity +/- buttons for easier tapping', () => {
    const item = {
      details: '',
      id: 'item-1',
      image_url: undefined,
      name: 'Baci Phone',
      price: 25000,
      product_id: 'product-1',
      quantity: 2,
      variant_id: null,
      variant_name: null,
    };
    const controller = makeController({ orderItems: [item] });

    render(<NewOrderItemsSection controller={controller} />);

    const decreaseBtn = screen.getByRole('button', {
      name: 'Decrease quantity for Baci Phone, current 2',
    });
    const increaseBtn = screen.getByRole('button', {
      name: 'Increase quantity for Baci Phone, current 2',
    });

    const expected = { top: 12, right: 12, bottom: 12, left: 12 };

    expect(decreaseBtn.getAttribute('data-hit-slop')).toBe(
      JSON.stringify(expected)
    );
    expect(increaseBtn.getAttribute('data-hit-slop')).toBe(
      JSON.stringify(expected)
    );

    const decreaseSlop = JSON.parse(
      decreaseBtn.getAttribute('data-hit-slop') ?? '{}'
    );
    const increaseSlop = JSON.parse(
      increaseBtn.getAttribute('data-hit-slop') ?? '{}'
    );

    for (const slop of [decreaseSlop, increaseSlop]) {
      expect(slop.top).toBeGreaterThanOrEqual(12);
      expect(slop.right).toBeGreaterThanOrEqual(12);
      expect(slop.bottom).toBeGreaterThanOrEqual(12);
      expect(slop.left).toBeGreaterThanOrEqual(12);
    }
  });
});
