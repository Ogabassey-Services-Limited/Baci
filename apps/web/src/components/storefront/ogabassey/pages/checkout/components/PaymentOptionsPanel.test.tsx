import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaymentOptionsPanel } from './PaymentOptionsPanel';

vi.mock('../../../components/PaymentLogos', () => ({
  PaystackLogo: ({ className }: { className?: string }) => (
    <span data-testid="paystack-logo" className={className} />
  ),
  KorapayLogo: ({ className }: { className?: string }) => (
    <span data-testid="korapay-logo" className={className} />
  ),
  CredPalLogo: ({ className }: { className?: string }) => (
    <span data-testid="credpal-logo" className={className} />
  ),
  CreditDirectLogo: ({ className }: { className?: string }) => (
    <span data-testid="credit-direct-logo" className={className} />
  ),
  JuicywayLogo: ({ className }: { className?: string }) => (
    <span data-testid="juicyway-logo" className={className} />
  ),
  BankTransferLogo: ({ className }: { className?: string }) => (
    <span data-testid="bank-transfer-logo" className={className} />
  ),
}));

describe('PaymentOptionsPanel', () => {
  it('renders full payment options and resets payment method on tab switch', async () => {
    const setPaymentTab = vi.fn();
    const setPaymentMethod = vi.fn();
    const user = userEvent.setup();

    render(
      <PaymentOptionsPanel
        paymentTab="full"
        setPaymentTab={setPaymentTab}
        paymentMethod=""
        setPaymentMethod={setPaymentMethod}
        paystackCheckoutAvailable={true}
        korapayCheckoutAvailable={false}
        bankTransferCheckoutAvailable={true}
        featureSettings={{ juicyway_enabled: true }}
        klumpEligible={false}
        hasInstallmentOptions={false}
      />,
    );

    expect(screen.getByRole('radio', { name: /paystack/i })).toBeInTheDocument();
    expect(screen.getByText('Bank Transfer')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /pay in installments/i }));

    expect(setPaymentTab).toHaveBeenCalledWith('installments');
    expect(setPaymentMethod).toHaveBeenCalledWith('');
  });

  it('renders Klump and its information when eligible and selected', () => {
    render(
      <PaymentOptionsPanel
        paymentTab="installments"
        setPaymentTab={vi.fn()}
        paymentMethod="klump"
        setPaymentMethod={vi.fn()}
        paystackCheckoutAvailable={false}
        korapayCheckoutAvailable={false}
        bankTransferCheckoutAvailable={false}
        featureSettings={{ klump_enabled: true }}
        klumpEligible={true}
        hasInstallmentOptions={true}
      />,
    );

    expect(screen.getByRole('radio', { name: /klump/i })).toBeChecked();
    expect(screen.getByText('How Klump works')).toBeInTheDocument();
  });
});
