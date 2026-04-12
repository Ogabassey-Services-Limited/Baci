import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { LIGHT_COLORS } from '@/constants/theme';
import {
  OrderItemDetailModal,
  type OrderItemSnapshot,
} from './OrderItemDetailModal';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: ({ name }: { color?: string; name: string; size?: number }) => name,
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ bottom: 0, left: 0, right: 0, top: 0 }),
}));

vi.mock('@/components/ui/SafeImage', () => ({
  default: ({ source }: { source?: { uri?: string } }) => source?.uri ?? null,
}));

vi.mock('@/hooks/useTheme', () => ({
  useTheme: () => ({
    colors: LIGHT_COLORS,
  }),
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Modal: ({
      children,
      visible,
    }: {
      children?: React.ReactNode;
      visible?: boolean;
    }) => (visible ? React.createElement('div', null, children) : null),
    Platform: { OS: 'ios' },
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
          onClick: onPress,
        },
        children
      ),
    StyleSheet: {
      absoluteFillObject: {},
      create: (styles: Record<string, unknown>) => styles,
      hairlineWidth: 1,
    },
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

function createItem(
  overrides: Partial<OrderItemSnapshot> = {}
): OrderItemSnapshot {
  return {
    id: 'item-1',
    condition: 'open_box',
    image_url: 'https://example.com/s22.png',
    name: 'Samsung Galaxy S22 Ultra',
    price: 500000,
    product_id: '1e3a022f-608c-45c4-8afa-b29e6c673b8b',
    quantity: 1,
    variant_name: '128GB / Phantom Black',
    ...overrides,
  };
}

describe('OrderItemDetailModal', () => {
  it('renders the order snapshot details instead of an edit flow', () => {
    render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={vi.fn()}
        visible
      />
    );

    expect(screen.getByText('Item Details')).toBeTruthy();
    expect(
      screen.getByText(
        'This is the order snapshot the customer actually bought.'
      )
    ).toBeTruthy();
    expect(screen.getByText('Samsung Galaxy S22 Ultra')).toBeTruthy();
    expect(screen.getByText('128GB / Phantom Black')).toBeTruthy();
    expect(screen.getByText('Quantity')).toBeTruthy();
    expect(screen.getByText('Unit price')).toBeTruthy();
    expect(screen.getByText('Line total')).toBeTruthy();
    expect(screen.getByText('Condition')).toBeTruthy();
    expect(screen.getByText('Open Box')).toBeTruthy();
    expect(screen.queryByText('Edit Product')).toBeNull();
  });

  it('closes when the user presses the close control', () => {
    const onClose = vi.fn();

    render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={onClose}
        visible
      />
    );

    fireEvent.click(screen.getByLabelText('Close item details'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exposes accessible button controls for both dismissal actions', () => {
    render(
      <OrderItemDetailModal
        formattedLineTotal="₦500,000"
        formattedUnitPrice="₦500,000"
        item={createItem()}
        onClose={vi.fn()}
        visible
      />
    );

    expect(
      screen.getByRole('button', { name: 'Close item details' })
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Close item detail sheet' })
    ).toBeTruthy();
  });
});
