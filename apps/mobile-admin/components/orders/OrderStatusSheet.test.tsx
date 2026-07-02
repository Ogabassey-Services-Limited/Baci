import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderStatusSheet } from './OrderStatusSheet';

vi.mock('@/components/ui/AppSheetModal', () => ({
  AppSheetModal: () => {
    throw new Error('OrderStatusSheet should use OrderStatusDrawerFrame');
  },
}));

vi.mock('./OrderStatusDrawerFrame', () => ({
  OrderStatusDrawerFrame: ({
    children,
    closeLabel,
    contentRowCount,
    onClose,
    title,
    visible,
  }: {
    children?: React.ReactNode;
    closeLabel: string;
    contentRowCount?: number;
    onClose: () => void;
    title: string;
    visible: boolean;
  }) =>
    visible ? (
      <section
        aria-label="Order status sheet"
        data-row-count={contentRowCount}
        data-title={title}
      >
        <button aria-label={closeLabel} onClick={onClose} type="button" />
        {children}
      </section>
    ) : null,
}));

vi.mock('@react-native-vector-icons/ionicons', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

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
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderStatusSheet', () => {
  const colors = {
    background: '#050713',
    border: '#e2e8f0',
    cancelled: '#dc2626',
    card: '#ffffff',
    delivered: '#16a34a',
    pending: '#ca8a04',
    primary: '#2563eb',
    processing: '#2563eb',
    returned: '#9333ea',
    shipped: '#7c3aed',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textSecondary: '#64748b',
  };

  it('renders the available status actions and selects a valid one', () => {
    const onSelectStatus = vi.fn();

    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={onSelectStatus}
        shippingStatus="pending"
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Confirm Order' }));

    expect(onSelectStatus).toHaveBeenCalledWith('processing');
  });

  it('sizes the drawer from the configured status row count', () => {
    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={vi.fn()}
        shippingStatus="pending"
        visible={true}
      />
    );

    expect(screen.getByLabelText('Order status sheet')).toHaveAttribute(
      'data-row-count',
      '6'
    );
  });

  it('renders shipment actions for processing orders', () => {
    const onSelectStatus = vi.fn();

    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={onSelectStatus}
        shippingStatus="processing"
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Ship Order' }));

    expect(onSelectStatus).toHaveBeenCalledWith('shipped');
  });

  it('invokes onClose from the close control', () => {
    const onClose = vi.fn();

    render(
      <OrderStatusSheet
        colors={colors}
        onClose={onClose}
        onSelectStatus={vi.fn()}
        shippingStatus="pending"
        visible={true}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Close status sheet' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not render when hidden', () => {
    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={vi.fn()}
        shippingStatus="pending"
        visible={false}
      />
    );

    expect(
      screen.queryByLabelText('Order status sheet')
    ).not.toBeInTheDocument();
  });

  it('renders the returned action as disabled for shipped orders', () => {
    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={vi.fn()}
        shippingStatus="shipped"
        visible={true}
      />
    );

    expect(screen.getByRole('button', { name: 'Returned' })).toBeDisabled();
  });

  it('treats legacy fulfilled orders as delivered in the status sheet', () => {
    const onSelectStatus = vi.fn();

    render(
      <OrderStatusSheet
        colors={colors}
        onClose={vi.fn()}
        onSelectStatus={onSelectStatus}
        shippingStatus="fulfilled"
        visible={true}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Delivered' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Process Return' }));

    expect(onSelectStatus).toHaveBeenCalledWith('returned');
  });
});
