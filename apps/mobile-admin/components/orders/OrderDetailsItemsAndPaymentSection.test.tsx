import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import type { OrderDetailsItem } from './order-details.types';
import { OrderDetailsItemsAndPaymentSection } from './OrderDetailsItemsAndPaymentSection';

const mocks = vi.hoisted(() => ({
  itemsCard: vi.fn(),
  paymentCard: vi.fn(),
}));

vi.mock('./OrderDetailsItemsCard', () => ({
  OrderDetailsItemsCard: (props: unknown) => {
    mocks.itemsCard(props);
    return <div data-testid="items-card" />;
  },
}));

vi.mock('./OrderDetailsPaymentCard', () => ({
  OrderDetailsPaymentCard: (props: unknown) => {
    mocks.paymentCard(props);
    return <div data-testid="payment-card" />;
  },
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderDetailsItemsAndPaymentSection', () => {
  const colors = {
    backgroundLight: '#f8fafc',
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    primary: '#2563eb',
    success: '#16a34a',
    text: '#0f172a',
    textMuted: '#94a3b8',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as ThemeColors;

  const items: OrderDetailsItem[] = [
    {
      id: 'item-1',
      image_url: 'https://example.com/phone.jpg',
      name: 'Phone',
      price: 250000,
      product_id: 'product-1',
      quantity: 2,
      variant_name: 'Black / 256GB',
    },
  ];

  it('passes the item-specific props into the extracted items card', () => {
    const formatPrice = vi.fn((amount: number) => `₦${amount}`);
    const onSelectItem = vi.fn();

    render(
      <OrderDetailsItemsAndPaymentSection
        amountPaid={200000}
        balance={50000}
        colors={colors}
        discountAmount={10000}
        formatPrice={formatPrice}
        items={items}
        onRecordPayment={vi.fn()}
        onRequestPayment={vi.fn()}
        onSelectItem={onSelectItem}
        paymentColor="#ca8a04"
        paymentLabel="Awaiting Payment"
        paymentMethod="bank_transfer"
        paymentStatus="pending"
        shippingFee={5000}
        subtotal={255000}
        total={250000}
      />
    );

    expect(screen.getByTestId('items-card')).toBeInTheDocument();
    expect(mocks.itemsCard).toHaveBeenCalledWith({
      colors,
      formatPrice,
      items,
      onSelectItem,
    });
  });

  it('passes the payment summary props into the extracted payment card', () => {
    const formatPrice = vi.fn((amount: number) => `₦${amount}`);
    const onRecordPayment = vi.fn();
    const onRequestPayment = vi.fn();

    render(
      <OrderDetailsItemsAndPaymentSection
        amountPaid={200000}
        balance={50000}
        colors={colors}
        discountAmount={10000}
        formatPrice={formatPrice}
        items={items}
        onRecordPayment={onRecordPayment}
        onRequestPayment={onRequestPayment}
        onSelectItem={vi.fn()}
        paymentColor="#ca8a04"
        paymentLabel="Awaiting Payment"
        paymentMethod="bank_transfer"
        paymentStatus="pending"
        shippingFee={5000}
        subtotal={255000}
        total={250000}
      />
    );

    expect(screen.getByTestId('payment-card')).toBeInTheDocument();
    expect(mocks.paymentCard).toHaveBeenCalledWith({
      amountPaid: 200000,
      balance: 50000,
      colors,
      discountAmount: 10000,
      formatPrice,
      onRecordPayment,
      onRequestPayment,
      paymentColor: '#ca8a04',
      paymentLabel: 'Awaiting Payment',
      paymentMethod: 'bank_transfer',
      paymentStatus: 'pending',
      shippingFee: 5000,
      subtotal: 255000,
      total: 250000,
    });
  });
});
