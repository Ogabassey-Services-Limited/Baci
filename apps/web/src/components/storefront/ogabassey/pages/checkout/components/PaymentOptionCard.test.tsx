import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstallmentInfo, PaymentOptionCard } from './PaymentOptionCard';

describe('PaymentOptionCard', () => {
  it('renders and selects a payment method', async () => {
    const setPaymentMethod = vi.fn();
    const user = userEvent.setup();

    render(
      <PaymentOptionCard
        method="paystack"
        paymentMethod=""
        setPaymentMethod={setPaymentMethod}
        title="Paystack"
        description="Card, Bank Transfer, USSD"
        badge={{ label: 'Popular', className: 'bg-green-100 text-green-700' }}
        icon={<span data-testid="payment-logo" />}
      />,
    );

    await user.click(screen.getByRole('radio', { name: /paystack/i }));

    expect(screen.getByText('Popular')).toBeInTheDocument();
    expect(screen.getByTestId('payment-logo')).toBeInTheDocument();
    expect(setPaymentMethod).toHaveBeenCalledWith('paystack');
  });

  it('renders installment information items', () => {
    render(
      <InstallmentInfo
        title="How Klump works"
        tone="primary"
        items={['Choose Klump at checkout', 'Split payment over time']}
      />,
    );

    expect(screen.getByText('How Klump works')).toBeInTheDocument();
    expect(screen.getByText('- Choose Klump at checkout')).toBeInTheDocument();
  });
});
