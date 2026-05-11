import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PaymentStep } from './PaymentStep';
import type { PaymentMethod, PaymentTab } from '../types';

// Mock PaymentLogos module
vi.mock('../../../components/PaymentLogos', () => ({
  PaystackLogo: vi.fn(({ className }) => <div data-testid="paystack-logo" className={className} />),
  CredPalLogo: vi.fn(({ className }) => <div data-testid="credpal-logo" className={className} />),
  CreditDirectLogo: vi.fn(({ className }) => <div data-testid="credit-direct-logo" className={className} />),
  JuicywayLogo: vi.fn(({ className }) => <div data-testid="juicyway-logo" className={className} />),
  BankTransferLogo: vi.fn(({ className }) => <div data-testid="bank-transfer-logo" className={className} />),
}));

type StepName = 'contact' | 'delivery' | 'payment';

interface CompletedSteps {
  contact: boolean;
  delivery: boolean;
}

interface FeatureSettings {
  paystack_enabled?: boolean;
  juicyway_enabled?: boolean;
  pay_on_delivery_enabled?: boolean;
  credpal_enabled?: boolean;
  credit_direct_enabled?: boolean;
}

describe('PaymentStep', () => {
  const defaultProps = {
    currentStep: 'payment' as StepName,
    completedSteps: { contact: true, delivery: true } as CompletedSteps,
    paymentTab: 'full' as PaymentTab,
    setPaymentTab: vi.fn(),
    paymentMethod: '' as PaymentMethod,
    setPaymentMethod: vi.fn(),
    isProcessing: false,
    isPayForMeValid: true,
    isDeliveryValid: true,
    payForMeDetails: { name: '', contact: '', note: '' },
    setPayForMeDetails: vi.fn(),
    dva: { isInitializingDva: false },
    newsletterOptIn: false,
    setNewsletterOptIn: vi.fn(),
    handlePlaceOrder: vi.fn(),
    setCurrentStep: vi.fn(),
    merchant: { paystack_subaccount_code: 'ACCT_123' },
    user: null,
    remainingAmount: 10000,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders payment step when currentStep is payment', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} />);

      // Assert
      expect(screen.getByText('Payment Method')).toBeInTheDocument();
    });

    it('applies active styling when currentStep is payment', () => {
      // Arrange & Act
      const { container } = render(<PaymentStep {...defaultProps} />);

      // Assert
      // Tailwind v4 syntax: `border-(--store-primary)` replaces `border-[var(--store-primary)]`
      const stepContainer = container.querySelector('.border-\\(--store-primary\\)');
      expect(stepContainer).toBeInTheDocument();
    });

    it('hides payment options visually when currentStep is not payment', () => {
      // Arrange & Act
      const { container } = render(<PaymentStep {...defaultProps} currentStep="contact" />);

      // Assert - the content is rendered but visually hidden via CSS grid-rows-[0fr] opacity-0
      const gridContainer = container.querySelector('.grid-rows-\\[0fr\\]');
      expect(gridContainer).toBeInTheDocument();
      expect(gridContainer?.className).toContain('opacity-0');
    });

    it('shows step number when no payment method is selected', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} />);

      // Assert
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('shows checkmark when payment method is selected', () => {
      // Arrange & Act
      const { container } = render(
        <PaymentStep {...defaultProps} paymentMethod="paystack" />
      );

      // Assert
      const checkIcon = container.querySelector('.text-green-600');
      expect(checkIcon).toBeInTheDocument();
    });
  });

  describe('Payment Tabs', () => {
    it('renders Pay in Full and Pay in Installments tabs', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} />);

      // Assert
      expect(screen.getByRole('button', { name: /pay in full/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pay in installments/i })).toBeInTheDocument();
    });

    it('switches to installments tab when clicked', () => {
      // Arrange
      const setPaymentTab = vi.fn();
      const setPaymentMethod = vi.fn();
      render(
        <PaymentStep
          {...defaultProps}
          setPaymentTab={setPaymentTab}
          setPaymentMethod={setPaymentMethod}
        />
      );

      // Act
      fireEvent.click(screen.getByRole('button', { name: /pay in installments/i }));

      // Assert
      expect(setPaymentTab).toHaveBeenCalledWith('installments');
      expect(setPaymentMethod).toHaveBeenCalledWith('');
    });

    it('switches to full payment tab when clicked', () => {
      // Arrange
      const setPaymentTab = vi.fn();
      const setPaymentMethod = vi.fn();
      render(
        <PaymentStep
          {...defaultProps}
          paymentTab="installments"
          setPaymentTab={setPaymentTab}
          setPaymentMethod={setPaymentMethod}
        />
      );

      // Act
      fireEvent.click(screen.getByRole('button', { name: /pay in full/i }));

      // Assert
      expect(setPaymentTab).toHaveBeenCalledWith('full');
      expect(setPaymentMethod).toHaveBeenCalledWith('');
    });

    it('highlights active tab with correct styling', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} paymentTab="full" />);

      // Assert
      const fullTabButton = screen.getByRole('button', { name: /pay in full/i });
      expect(fullTabButton.className).toContain('bg-white');
      expect(fullTabButton.className).toContain('text-gray-900');
    });
  });

  describe('Pay in Full Options', () => {
    it('shows Paystack when the merchant has a Paystack subaccount', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} />);

      // Assert
      expect(screen.getByText('Paystack')).toBeInTheDocument();
      expect(screen.getByTestId('paystack-logo')).toBeInTheDocument();
    });

    it('shows Bank Transfer when the merchant has a Paystack subaccount', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} />);

      // Assert
      expect(screen.getByText('Bank Transfer')).toBeInTheDocument();
      expect(screen.getByTestId('bank-transfer-logo')).toBeInTheDocument();
    });

    it('hides Paystack when explicitly disabled in feature settings', () => {
      // Arrange
      const merchant = {
        paystack_subaccount_code: 'ACCT_123',
        feature_settings: { paystack_enabled: false } as FeatureSettings,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.queryByText('Paystack')).not.toBeInTheDocument();
      expect(screen.queryByText('Bank Transfer')).not.toBeInTheDocument();
    });

    it('hides Paystack and Bank Transfer when the merchant has no Paystack subaccount', () => {
      // Arrange
      const merchant = {
        paystack_subaccount_code: null,
        feature_settings: { paystack_enabled: true } as FeatureSettings,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.queryByText('Paystack')).not.toBeInTheDocument();
      expect(screen.queryByText('Bank Transfer')).not.toBeInTheDocument();
    });

    it('shows Juicyway when enabled in feature settings', () => {
      // Arrange
      const merchant = {
        feature_settings: { juicyway_enabled: true } as FeatureSettings,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.getByText('Juicyway')).toBeInTheDocument();
      expect(screen.getByTestId('juicyway-logo')).toBeInTheDocument();
    });

    it('hides Juicyway when not enabled in feature settings', () => {
      // Arrange
      const merchant = {
        feature_settings: { juicyway_enabled: false } as FeatureSettings,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.queryByText('Juicyway')).not.toBeInTheDocument();
    });

    it('shows Pay on Delivery when enabled in feature settings', () => {
      // Arrange
      const merchant = {
        feature_settings: { pay_on_delivery_enabled: true } as FeatureSettings,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.getByText('Pay on Delivery')).toBeInTheDocument();
      expect(screen.getByText(/pay when you receive your items/i)).toBeInTheDocument();
    });

    it('calls setPaymentMethod when Paystack is selected', () => {
      // Arrange
      const setPaymentMethod = vi.fn();
      render(<PaymentStep {...defaultProps} setPaymentMethod={setPaymentMethod} />);

      // Act
      const paystackLabel = screen.getByText('Paystack').closest('label');
      if (paystackLabel) fireEvent.click(paystackLabel);

      // Assert
      expect(setPaymentMethod).toHaveBeenCalledWith('paystack');
    });

    it('calls setPaymentMethod when Bank Transfer is selected', () => {
      // Arrange
      const setPaymentMethod = vi.fn();
      render(<PaymentStep {...defaultProps} setPaymentMethod={setPaymentMethod} />);

      // Act
      const bankTransferLabel = screen.getByText('Bank Transfer').closest('label');
      if (bankTransferLabel) fireEvent.click(bankTransferLabel);

      // Assert
      expect(setPaymentMethod).toHaveBeenCalledWith('bank_transfer');
    });

    it('clears a stale Paystack selection when Paystack is unavailable', () => {
      const setPaymentMethod = vi.fn();

      render(
        <PaymentStep
          {...defaultProps}
          merchant={null}
          paymentMethod="paystack"
          setPaymentMethod={setPaymentMethod}
        />
      );

      expect(setPaymentMethod).toHaveBeenCalledWith('');
    });

    it('clears a stale bank transfer selection when bank transfer is unavailable', () => {
      const setPaymentMethod = vi.fn();

      render(
        <PaymentStep
          {...defaultProps}
          merchant={null}
          paymentMethod="bank_transfer"
          setPaymentMethod={setPaymentMethod}
        />
      );

      expect(setPaymentMethod).toHaveBeenCalledWith('');
    });

    it.each([
      [
        'juicyway',
        {
          feature_settings: { juicyway_enabled: false } as FeatureSettings,
        },
      ],
      [
        'pod',
        {
          feature_settings: {
            pay_on_delivery_enabled: false,
          } as FeatureSettings,
        },
      ],
    ] as const)(
      'clears a stale %s selection when that gateway is unavailable',
      (paymentMethod, merchant) => {
        const setPaymentMethod = vi.fn();

        render(
          <PaymentStep
            {...defaultProps}
            merchant={merchant}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
          />
        );

        expect(setPaymentMethod).toHaveBeenCalledWith('');
      }
    );
  });

  describe('Pay in Installments Options', () => {
    it('shows CredPal when enabled in feature settings', () => {
      // Arrange
      const merchant = {
        feature_settings: { credpal_enabled: true } as FeatureSettings,
      };

      // Act
      render(
        <PaymentStep
          {...defaultProps}
          merchant={merchant}
          paymentTab="installments"
        />
      );

      // Assert
      expect(screen.getByText('CredPal')).toBeInTheDocument();
      expect(screen.getByTestId('credpal-logo')).toBeInTheDocument();
    });

    it('shows Credit Direct when enabled in feature settings', () => {
      // Arrange
      const merchant = {
        feature_settings: { credit_direct_enabled: true } as FeatureSettings,
      };

      // Act
      render(
        <PaymentStep
          {...defaultProps}
          merchant={merchant}
          paymentTab="installments"
        />
      );

      // Assert
      expect(screen.getByText('Credit Direct')).toBeInTheDocument();
      expect(screen.getByTestId('credit-direct-logo')).toBeInTheDocument();
    });

    it('shows empty state when no installment options are enabled', () => {
      // Arrange
      const merchant = {
        feature_settings: {
          credpal_enabled: false,
          credit_direct_enabled: false,
        } as FeatureSettings,
      };

      // Act
      render(
        <PaymentStep
          {...defaultProps}
          merchant={merchant}
          paymentTab="installments"
        />
      );

      // Assert
      expect(screen.getByText(/no installment options are currently available/i)).toBeInTheDocument();
    });

    it('shows CredPal info when CredPal is selected', () => {
      // Arrange
      const merchant = {
        feature_settings: { credpal_enabled: true } as FeatureSettings,
      };

      // Act
      render(
        <PaymentStep
          {...defaultProps}
          merchant={merchant}
          paymentTab="installments"
          paymentMethod="credpal"
        />
      );

      // Assert
      expect(screen.getByText('How CredPal works')).toBeInTheDocument();
      expect(screen.getByText(/quick approval in minutes/i)).toBeInTheDocument();
    });

    it('shows Credit Direct info when Credit Direct is selected', () => {
      // Arrange
      const merchant = {
        feature_settings: { credit_direct_enabled: true } as FeatureSettings,
      };

      // Act
      render(
        <PaymentStep
          {...defaultProps}
          merchant={merchant}
          paymentTab="installments"
          paymentMethod="credit_direct"
        />
      );

      // Assert
      expect(screen.getByText('How Credit Direct works')).toBeInTheDocument();
      expect(screen.getByText(/instant approval decision/i)).toBeInTheDocument();
    });

    it('calls setPaymentMethod when CredPal is selected', () => {
      // Arrange
      const setPaymentMethod = vi.fn();
      const merchant = {
        feature_settings: { credpal_enabled: true } as FeatureSettings,
      };
      render(
        <PaymentStep
          {...defaultProps}
          merchant={merchant}
          paymentTab="installments"
          setPaymentMethod={setPaymentMethod}
        />
      );

      // Act
      const credpalLabel = screen.getByText('CredPal').closest('label');
      if (credpalLabel) fireEvent.click(credpalLabel);

      // Assert
      expect(setPaymentMethod).toHaveBeenCalledWith('credpal');
    });

    it.each([
      [
        'credpal',
        {
          feature_settings: { credpal_enabled: false } as FeatureSettings,
        },
      ],
      [
        'credit_direct',
        {
          feature_settings: {
            credit_direct_enabled: false,
          } as FeatureSettings,
        },
      ],
    ] as const)(
      'clears a stale %s selection when that installment option is unavailable',
      (paymentMethod, merchant) => {
        const setPaymentMethod = vi.fn();

        render(
          <PaymentStep
            {...defaultProps}
            merchant={merchant}
            paymentTab="installments"
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
          />
        );

        expect(setPaymentMethod).toHaveBeenCalledWith('');
      }
    );
  });

  describe('Mobile Place Order Button', () => {
    it('shows place order button on mobile', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} />);

      // Assert
      expect(screen.getByRole('button', { name: /place order/i })).toBeInTheDocument();
    });

    it('shows Generate Invoice button text when payment method is invoice', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} paymentMethod="invoice" />);

      // Assert
      expect(screen.getByRole('button', { name: /generate invoice/i })).toBeInTheDocument();
    });

    it('shows Send Payment Link button text when payment method is payforme', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} paymentMethod="payforme" />);

      // Assert
      expect(screen.getByRole('button', { name: /send payment link/i })).toBeInTheDocument();
    });

    it('disables button when isProcessing is true', () => {
      // Arrange & Act
      const { container } = render(<PaymentStep {...defaultProps} isProcessing={true} />);

      // Assert - button exists but text is replaced with spinner
      const buttons = screen.getAllByRole('button');
      const placeOrderButton = buttons.find(btn => btn.className.includes('bg-(--store-primary)'));
      expect(placeOrderButton).toBeDisabled();

      // Verify spinner is shown
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('disables button when remainingAmount > 0 and no payment method selected', () => {
      // Arrange & Act
      render(
        <PaymentStep
          {...defaultProps}
          remainingAmount={5000}
          paymentMethod=""
        />
      );

      // Assert
      const button = screen.getByRole('button', { name: /place order/i });
      expect(button).toBeDisabled();
    });

    it('disables button when the selected gateway is no longer available', () => {
      render(
        <PaymentStep
          {...defaultProps}
          merchant={null}
          paymentMethod="paystack"
        />
      );

      const button = screen.getByRole('button', { name: /place order/i });
      expect(button).toBeDisabled();
    });

    it('disables button when a stale installment gateway is selected', () => {
      render(
        <PaymentStep
          {...defaultProps}
          merchant={{
            feature_settings: { credpal_enabled: false } as FeatureSettings,
          }}
          paymentTab="installments"
          paymentMethod="credpal"
        />
      );

      const button = screen.getByRole('button', { name: /place order/i });
      expect(button).toBeDisabled();
    });

    it('disables button when payment method is payforme and isPayForMeValid is false', () => {
      // Arrange & Act
      render(
        <PaymentStep
          {...defaultProps}
          paymentMethod="payforme"
          isPayForMeValid={false}
        />
      );

      // Assert
      const button = screen.getByRole('button', { name: /send payment link/i });
      expect(button).toBeDisabled();
    });

    it('shows loading spinner when isProcessing is true', () => {
      // Arrange & Act
      const { container } = render(<PaymentStep {...defaultProps} isProcessing={true} />);

      // Assert
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('calls handlePlaceOrder when button is clicked', () => {
      // Arrange
      const handlePlaceOrder = vi.fn();
      render(
        <PaymentStep
          {...defaultProps}
          handlePlaceOrder={handlePlaceOrder}
          paymentMethod="paystack"
        />
      );

      // Act
      fireEvent.click(screen.getByRole('button', { name: /place order/i }));

      // Assert
      expect(handlePlaceOrder).toHaveBeenCalledTimes(1);
    });
  });

  describe('Newsletter Opt-in', () => {
    it('shows newsletter opt-in checkbox when user is not logged in', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} user={null} />);

      // Assert
      expect(screen.getByText(/email me with exclusive offers/i)).toBeInTheDocument();
    });

    it('does not show newsletter opt-in checkbox when user is logged in', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} user={{ id: 'user-123' }} />);

      // Assert
      expect(screen.queryByText(/email me with exclusive offers/i)).not.toBeInTheDocument();
    });

    it('calls setNewsletterOptIn when checkbox is toggled', () => {
      // Arrange
      const setNewsletterOptIn = vi.fn();
      render(
        <PaymentStep
          {...defaultProps}
          user={null}
          setNewsletterOptIn={setNewsletterOptIn}
        />
      );

      // Act
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Assert
      expect(setNewsletterOptIn).toHaveBeenCalledWith(true);
    });
  });

  describe('Step Navigation', () => {
    it('allows clicking step header when delivery is completed', () => {
      // Arrange
      const setCurrentStep = vi.fn();
      render(
        <PaymentStep
          {...defaultProps}
          currentStep="delivery"
          completedSteps={{ contact: true, delivery: true }}
          setCurrentStep={setCurrentStep}
        />
      );

      // Act
      const stepButton = screen.getByRole('button', { name: /payment method/i });
      fireEvent.click(stepButton);

      // Assert
      expect(setCurrentStep).toHaveBeenCalledWith('payment');
    });

    it('disables step header button when delivery is not completed', () => {
      // Arrange & Act
      render(
        <PaymentStep
          {...defaultProps}
          currentStep="contact"
          completedSteps={{ contact: false, delivery: false }}
        />
      );

      // Assert
      const stepButton = screen.getByRole('button', { name: /payment method/i });
      expect(stepButton).toBeDisabled();
    });

    it('does not call setCurrentStep when delivery is not completed', () => {
      // Arrange
      const setCurrentStep = vi.fn();
      render(
        <PaymentStep
          {...defaultProps}
          currentStep="contact"
          completedSteps={{ contact: false, delivery: false }}
          setCurrentStep={setCurrentStep}
        />
      );

      // Act
      const stepButton = screen.getByRole('button', { name: /payment method/i });
      fireEvent.click(stepButton);

      // Assert
      expect(setCurrentStep).not.toHaveBeenCalled();
    });
  });

  describe('Payment Method Selection States', () => {
    it('highlights selected payment method with border and background', () => {
      // Arrange & Act
      render(
        <PaymentStep {...defaultProps} paymentMethod="paystack" />
      );

      // Assert
      const paystackLabel = screen.getByText('Paystack').closest('label');
      expect(paystackLabel?.className).toContain('border-(--store-primary)');
      expect(paystackLabel?.className).toContain('bg-(--store-primary)/5');
    });

    it('shows radio button as checked when payment method is selected', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} paymentMethod="paystack" />);

      // Assert
      const paystackRadio = screen.getByRole('radio', { name: /paystack/i });
      expect(paystackRadio).toBeChecked();
    });

    it('shows radio button as unchecked when payment method is not selected', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} paymentMethod="" />);

      // Assert
      const paystackRadio = screen.getByRole('radio', { name: /paystack/i });
      expect(paystackRadio).not.toBeChecked();
    });
  });

  describe('Edge Cases', () => {
    it('handles null merchant gracefully', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} merchant={null} />);

      // Assert
      expect(screen.queryByText('Paystack')).not.toBeInTheDocument();
    });

    it('handles undefined merchant gracefully', () => {
      // Arrange & Act
      render(<PaymentStep {...defaultProps} merchant={undefined} />);

      // Assert
      expect(screen.queryByText('Paystack')).not.toBeInTheDocument();
    });

    it('handles merchant with null feature_settings', () => {
      // Arrange
      const merchant = {
        paystack_subaccount_code: 'ACCT_123',
        feature_settings: null,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.getByText('Paystack')).toBeInTheDocument();
    });

    it('handles merchant with undefined feature_settings', () => {
      // Arrange
      const merchant = {
        paystack_subaccount_code: 'ACCT_123',
        feature_settings: undefined,
      };

      // Act
      render(<PaymentStep {...defaultProps} merchant={merchant} />);

      // Assert
      expect(screen.getByText('Paystack')).toBeInTheDocument();
    });

    it('handles remainingAmount of 0', () => {
      // Arrange & Act
      render(
        <PaymentStep
          {...defaultProps}
          remainingAmount={0}
          paymentMethod=""
        />
      );

      // Assert
      const button = screen.getByRole('button', { name: /place order/i });
      expect(button).not.toBeDisabled();
    });
  });
});
