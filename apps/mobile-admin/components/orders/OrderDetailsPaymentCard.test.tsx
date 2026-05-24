import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { ThemeColors } from '@/constants/theme';
import { OrderDetailsPaymentCard } from './OrderDetailsPaymentCard';

vi.mock('@react-native-vector-icons/ionicons/static', () => ({
  Ionicons: () => null,

  default: () => null,
  __esModule: true,
}));

vi.mock('react-native', async () => {
  const React = await import('react');

  return {
    Pressable: ({
      accessibilityLabel,
      accessibilityRole,
      children,
      onPress,
    }: {
      accessibilityLabel?: string;
      accessibilityRole?: string;
      children?: React.ReactNode;
      onPress?: () => void;
    }) =>
      React.createElement(
        'div',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          role: accessibilityRole,
        },
        children
      ),
    Text: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('span', null, children),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

describe('OrderDetailsPaymentCard', () => {
  const colors = {
    backgroundLight: '#f8fafc',
    border: '#e2e8f0',
    card: '#ffffff',
    error: '#dc2626',
    primary: '#2563eb',
    success: '#16a34a',
    text: '#0f172a',
    textOnPrimary: '#ffffff',
    textSecondary: '#64748b',
  } as ThemeColors;

  it('triggers the payment action handlers for unpaid orders', () => {
    const onRecordPayment = vi.fn();
    const onRequestPayment = vi.fn();

    render(
      <OrderDetailsPaymentCard
        amountPaid={7500}
        balance={2500}
        colors={colors}
        discountAmount={0}
        formatPrice={(amount) => `₦${amount}`}
        onRecordPayment={onRecordPayment}
        onRequestPayment={onRequestPayment}
        paymentColor="#ca8a04"
        paymentLabel="Awaiting Payment"
        paymentMethod="bank_transfer"
        paymentStatus="pending"
        shippingFee={1000}
        subtotal={9000}
        total={10000}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Record payment' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Request payment' })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Record payment' }));
    fireEvent.click(screen.getByRole('button', { name: 'Request payment' }));

    expect(onRecordPayment).toHaveBeenCalledTimes(1);
    expect(onRequestPayment).toHaveBeenCalledTimes(1);
  });

  it('hides payment action buttons when the order is fully paid', () => {
    render(
      <OrderDetailsPaymentCard
        amountPaid={10000}
        balance={0}
        colors={colors}
        discountAmount={0}
        formatPrice={(amount) => `₦${amount}`}
        onRecordPayment={vi.fn()}
        onRequestPayment={vi.fn()}
        paymentColor="#16a34a"
        paymentLabel="Paid"
        paymentMethod="bank_transfer"
        paymentStatus="paid"
        shippingFee={1000}
        subtotal={9000}
        total={10000}
      />
    );

    expect(
      screen.queryByRole('button', { name: 'Record payment' })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Request payment' })
    ).not.toBeInTheDocument();
  });

  it('renders discount, payment method formatting, and balance rows for unpaid orders', () => {
    render(
      <OrderDetailsPaymentCard
        amountPaid={3000}
        balance={7000}
        colors={colors}
        discountAmount={500}
        formatPrice={(amount) => `₦${amount}`}
        onRecordPayment={vi.fn()}
        onRequestPayment={vi.fn()}
        paymentColor="#ca8a04"
        paymentLabel="Awaiting Payment"
        paymentMethod="bank_transfer"
        paymentStatus="pending"
        shippingFee={0}
        subtotal={0}
        total={10000}
      />
    );

    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('-₦500')).toBeInTheDocument();
    expect(screen.getAllByText('₦10000')).toHaveLength(2);
    expect(screen.getByText('bank transfer')).toBeInTheDocument();
    expect(screen.getByText('₦3000')).toBeInTheDocument();
    expect(screen.getByText('₦7000')).toBeInTheDocument();
  });

  it('falls back payment method and hides the balance row when nothing is due', () => {
    render(
      <OrderDetailsPaymentCard
        amountPaid={10000}
        balance={0}
        colors={colors}
        discountAmount={0}
        formatPrice={(amount) => `₦${amount}`}
        onRecordPayment={vi.fn()}
        onRequestPayment={vi.fn()}
        paymentColor="#16a34a"
        paymentLabel="Paid"
        paymentMethod={null}
        paymentStatus="paid"
        shippingFee={1500}
        subtotal={9000}
        total={10500}
      />
    );

    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
    expect(screen.getByText('₦1500')).toBeInTheDocument();
    expect(screen.getByText('N/A')).toBeInTheDocument();
    expect(screen.queryByText('Balance Due')).not.toBeInTheDocument();
  });
});
