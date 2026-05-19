import { render, screen } from '@testing-library/react-native';
import {
  getOrderDetailsPaymentLabel,
  type OrderDetailsSummaryBreakdown,
  OrderDetailsSummaryCard,
} from './OrderDetailsSummaryCard';

const colors = {
  border: '#e5e7eb',
  card: '#ffffff',
  text: '#111827',
  textSecondary: '#6b7280',
} as const;

const formatCurrency = (amount: number) => `NGN-${amount}`;

function buildBreakdown(
  overrides: Partial<OrderDetailsSummaryBreakdown> = {}
): OrderDetailsSummaryBreakdown {
  return {
    itemsSubtotal: 470000,
    assuranceFee: 0,
    shippingFee: 0,
    taxAmount: 0,
    discountAmount: 0,
    total: 470000,
    ...overrides,
  };
}

describe('OrderDetailsSummaryCard', () => {
  it('renders base rows and pending payment state', () => {
    render(
      <OrderDetailsSummaryCard
        colors={colors}
        formatCurrency={formatCurrency}
        paymentMethod="card"
        paymentStatus="pending"
        summaryBreakdown={buildBreakdown()}
      />
    );

    expect(screen.getByText('Order Summary')).toBeTruthy();
    expect(screen.getByText('Subtotal')).toBeTruthy();
    expect(screen.getAllByText('NGN-470000')).toHaveLength(2);
    expect(screen.getByText('Shipping')).toBeTruthy();
    expect(screen.getByText('Free')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Payment pending')).toBeTruthy();
    expect(screen.queryByText('Device Assurance')).toBeNull();
    expect(screen.queryByText('VAT')).toBeNull();
    expect(screen.queryByText('Discount')).toBeNull();
  });

  it('renders optional rows and paid payment method label', () => {
    render(
      <OrderDetailsSummaryCard
        colors={colors}
        formatCurrency={formatCurrency}
        paymentMethod="bank_transfer"
        paymentStatus="paid"
        summaryBreakdown={buildBreakdown({
          assuranceFee: 12000,
          shippingFee: 4000,
          taxAmount: 2500,
          discountAmount: 3000,
          total: 485500,
        })}
      />
    );

    expect(screen.getByText('Device Assurance')).toBeTruthy();
    expect(screen.getByText('NGN-12000')).toBeTruthy();
    expect(screen.getByText('VAT')).toBeTruthy();
    expect(screen.getByText('NGN-2500')).toBeTruthy();
    expect(screen.getByText('Discount')).toBeTruthy();
    expect(screen.getByText('-NGN-3000')).toBeTruthy();
    expect(screen.getByText('Paid via bank transfer')).toBeTruthy();
  });
});

describe('getOrderDetailsPaymentLabel', () => {
  it.each([
    ['card', 'pending', 'Payment pending'],
    ['bank_transfer', 'paid', 'Paid via bank transfer'],
    ['wallet_balance', 'partially_paid', 'Partially paid via wallet balance'],
    ['card', 'failed', 'card - failed'],
  ])('formats payment label for %s/%s', (method, status, expected) => {
    expect(getOrderDetailsPaymentLabel(method, status)).toBe(expected);
  });
});
