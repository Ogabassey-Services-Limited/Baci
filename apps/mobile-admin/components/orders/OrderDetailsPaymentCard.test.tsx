import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { OrderDetailsPaymentCard } from './OrderDetailsPaymentCard';

vi.mock('@expo/vector-icons', () => ({
  Ionicons: () => null,
}));

vi.mock('./order-details-items.styles', () => ({
  orderDetailsItemsStyles: {},
}));

vi.mock('@/lib/colors/sanitize-css-color', () => ({
  getTranslucentColor: (color: string) => color,
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
        'button',
        {
          'aria-label': accessibilityLabel,
          onClick: () => onPress?.(),
          role: accessibilityRole,
          type: 'button',
        },
        children
      ),
    StyleSheet: {
      create: (styles: Record<string, unknown>) => styles,
    },
    Text: ({
      children,
      style,
    }: {
      children?: React.ReactNode;
      style?: unknown;
    }) =>
      React.createElement(
        'span',
        { 'data-style': JSON.stringify(style ?? null) },
        children
      ),
    View: ({ children }: { children?: React.ReactNode }) =>
      React.createElement('div', null, children),
  };
});

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
} as const;

const formatPrice = (amount: number) => `NGN ${amount.toFixed(2)}`;

type CardProps = React.ComponentProps<typeof OrderDetailsPaymentCard>;

const renderCard = (overrides: Partial<CardProps> = {}) =>
  render(
    <OrderDetailsPaymentCard
      amountPaid={0}
      balance={0}
      colors={colors as unknown as CardProps['colors']}
      discountAmount={0}
      formatPrice={formatPrice}
      onRecordPayment={vi.fn()}
      onRequestPayment={vi.fn()}
      paymentColor="#ca8a04"
      paymentLabel="Pending"
      paymentMethod={null}
      paymentStatus="pending"
      shippingFee={null}
      subtotal={5000}
      total={5000}
      {...overrides}
    />
  );

describe('OrderDetailsPaymentCard', () => {
  it('hides Record and Request payment actions when payment status is paid', () => {
    renderCard({ paymentStatus: 'paid' });

    expect(
      screen.queryByRole('button', { name: /record payment/i })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /request payment/i })
    ).not.toBeInTheDocument();
  });

  it('renders the discount row when discountAmount is greater than zero', () => {
    renderCard({ discountAmount: 500 });

    expect(screen.getByText('Discount')).toBeInTheDocument();
    expect(screen.getByText('-NGN 500.00')).toBeInTheDocument();
  });

  it('omits the discount row when discountAmount is zero', () => {
    renderCard({ discountAmount: 0 });

    expect(screen.queryByText('Discount')).not.toBeInTheDocument();
  });

  it('displays "Free" when shippingFee is null', () => {
    renderCard({ shippingFee: null });

    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('displays "Free" when shippingFee is zero', () => {
    renderCard({ shippingFee: 0 });

    expect(screen.getByText('Free')).toBeInTheDocument();
  });

  it('formats shippingFee when it is a positive number', () => {
    renderCard({ shippingFee: 500 });

    expect(screen.getByText('NGN 500.00')).toBeInTheDocument();
    expect(screen.queryByText('Free')).not.toBeInTheDocument();
  });

  it('renders the amount paid value in success color when amountPaid > 0', () => {
    renderCard({ amountPaid: 2500 });

    const paid = screen.getByText('NGN 2500.00');
    expect(paid).toBeInTheDocument();
    expect(paid.getAttribute('data-style') ?? '').toContain(colors.success);
  });

  it('renders the amount paid value in secondary color when amountPaid is zero', () => {
    renderCard({ amountPaid: 0 });

    const paid = screen.getByText('NGN 0.00');
    expect(paid).toBeInTheDocument();
    expect(paid.getAttribute('data-style') ?? '').toContain(
      colors.textSecondary
    );
  });

  it('renders the Balance Due row when balance > 0', () => {
    renderCard({ balance: 1500 });

    expect(screen.getByText('Balance Due')).toBeInTheDocument();
    expect(screen.getByText('NGN 1500.00')).toBeInTheDocument();
  });

  it('omits the Balance Due row when balance is zero', () => {
    renderCard({ balance: 0 });

    expect(screen.queryByText('Balance Due')).not.toBeInTheDocument();
  });
});
