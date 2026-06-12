import './orders-screen-test-utils';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { OrderItem } from './OrderItem';
import { mockOrder } from './orders-screen-test-utils';

describe('OrderItem', () => {
  it('opens details and exposes the shipping status control', () => {
    const onPress = vi.fn();
    const onStatusPress = vi.fn();

    render(
      <OrderItem
        currency="NGN"
        getPaymentStatusConfig={() => ({ color: '#16a34a', label: 'Paid' })}
        getShippingStatusConfig={() => ({
          color: '#ca8a04',
          label: 'Unfulfilled',
        })}
        getSourceConfig={() => ({
          color: '#2563eb',
          icon: 'globe-outline',
          label: 'Website',
        })}
        item={mockOrder}
        onPress={onPress}
        onStatusPress={onStatusPress}
      />
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Order ORD-1001 from Ada Doe, ₦10,000, Unfulfilled, Paid/i,
      })
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Shipping status: Unfulfilled. Tap to change status',
      })
    );

    expect(onPress).toHaveBeenCalledWith('order-1');
    expect(onStatusPress).toHaveBeenCalledWith(mockOrder, expect.any(Object));
  });
});
