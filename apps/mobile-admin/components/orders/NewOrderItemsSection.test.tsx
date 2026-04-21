import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { NewOrderItemsSection } from './NewOrderItemsSection';

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
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: () => React.createElement('div', { 'data-testid': 'safe-image' }),
}));

vi.mock('./NewOrderSummarySection', () => ({
  NewOrderSummarySection: () =>
    React.createElement('div', { 'data-testid': 'summary-section' }),
}));

vi.mock('@/lib/colors/sanitize-css-color', () => ({
  getTranslucentColor: () => 'rgba(0,0,0,0.1)',
}));

vi.mock('./new-order.styles', () => ({ styles: {} }));

function makeController(overrides = {}) {
  return {
    colors: {
      background: '#fff',
      backgroundLight: '#f9f9f9',
      border: '#ccc',
      card: '#fff',
      error: '#ef4444',
      primary: '#3b82f6',
      text: '#000',
      textMuted: '#999',
      textOnPrimary: '#fff',
      textSecondary: '#666',
    },
    formatPrice: (n: number) => `₦${n}`,
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('NewOrderItemsSection', () => {
  it('renders without crashing', () => {
    render(<NewOrderItemsSection controller={makeController()} />);
    expect(screen.getByText('Products')).toBeInTheDocument();
  });

  it('shows empty state message when there are no order items', () => {
    render(<NewOrderItemsSection controller={makeController()} />);
    expect(screen.getByText('No items added yet')).toBeInTheDocument();
  });

  it('renders order items when provided', () => {
    const controller = makeController({
      orderItems: [
        {
          id: 'item-1',
          image_url: null,
          is_custom: false,
          name: 'Test Product',
          price: 5000,
          product_id: 'prod-1',
          quantity: 2,
          variant_id: null,
          variant_name: null,
        },
      ],
    });

    render(<NewOrderItemsSection controller={controller} />);
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.queryByText('No items added yet')).toBeNull();
  });

  it('renders Quick Add and Search Catalog buttons', () => {
    render(<NewOrderItemsSection controller={makeController()} />);
    expect(screen.getByLabelText('Quick add item')).toBeInTheDocument();
    expect(screen.getByLabelText('Search catalog')).toBeInTheDocument();
  });
});
