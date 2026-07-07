import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { utilityModalTestHarness as harness } from './utility-modal-test-support';
import { UtilityModal } from './UtilityModal';

function renderOpenModal() {
  return render(
    <UtilityModal
      isOpen={true}
      onClose={harness.onClose}
    />
  );
}

describe('UtilityModal', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('returns null when isOpen is false', () => {
    const { container } = render(
      <UtilityModal
        isOpen={false}
        onClose={harness.onClose}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders the header, tabs, and default airtime form when open', () => {
    renderOpenModal();

    expect(screen.getByText('Utility Payment')).toBeInTheDocument();
    expect(screen.getByText('Airtime')).toBeInTheDocument();
    expect(screen.getByText('Data')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
    expect(screen.getByText('Power')).toBeInTheDocument();
    expect(screen.getByText('Betting')).toBeInTheDocument();
    expect(screen.getByTestId('airtime-data-form')).toHaveAttribute(
      'data-type',
      'airtime'
    );
  });

  it('switches to the bill payment form when a bill tab is selected', () => {
    renderOpenModal();

    fireEvent.click(screen.getByRole('tab', { name: 'TV' }));

    expect(screen.getByTestId('bill-payment-form')).toHaveAttribute(
      'data-type',
      'tv'
    );
  });

  it('shows wallet-only success state and notification', async () => {
    renderOpenModal();

    fireEvent.click(screen.getByText('Mock Submit'));

    await waitFor(() => {
      expect(screen.getByText('Success!')).toBeInTheDocument();
      expect(screen.getByText('REF123456')).toBeInTheDocument();
      expect(harness.toast).toHaveBeenCalledWith({
        title: 'Purchase Successful',
        description: 'Your airtime purchase was successful!',
      });
    });
  });

  it('shows available wallet credit as a selected payment method', () => {
    renderOpenModal();

    expect(
      screen.getByRole('radio', { name: /pay with wallet/i })
    ).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText(/₦500 available/i)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /pay with card/i })).toBeInTheDocument();
  });

  it('closes when the close button is selected', () => {
    renderOpenModal();

    fireEvent.click(screen.getByRole('button', { name: /close/i }));

    expect(harness.onClose).toHaveBeenCalledOnce();
  });

  it('offers the bank-transfer CTA when wallet DVAs are enabled and the customer has a phone', () => {
    harness.useWallet.mockReturnValue({
      fundingAccount: null,
      payWithWallet: true,
      refreshWallet: vi.fn(),
      requiresFundingAccountConsent: true,
      setFundingAccount: vi.fn(),
      setPayWithWallet: vi.fn(),
      setWalletBalance: vi.fn(),
      walletBalance: 500,
      walletDvaEnabled: true,
      walletLoading: false,
    });

    renderOpenModal();

    expect(
      screen.getByRole('button', { name: /pay with bank transfer/i })
    ).toBeInTheDocument();
  });

  it('hides the bank-transfer CTA when the merchant has wallet DVAs disabled', () => {
    // Default harness wallet mock leaves walletDvaEnabled undefined (falsy).
    renderOpenModal();

    expect(
      screen.queryByRole('button', { name: /pay with bank transfer/i })
    ).not.toBeInTheDocument();
  });

  it('hides the bank-transfer CTA when the customer has no phone and no DVA yet', () => {
    harness.useAuth.mockReturnValue({
      customer: {
        id: 'customer-1',
        email: 'customer@example.com',
        first_name: 'Test',
        last_name: 'Customer',
        phone: null,
      },
      isAuthenticated: true,
      isLoading: false,
      user: { email: 'customer@example.com', id: 'user-1', role: 'customer' },
    });
    harness.useWallet.mockReturnValue({
      fundingAccount: null,
      payWithWallet: true,
      refreshWallet: vi.fn(),
      requiresFundingAccountConsent: true,
      setFundingAccount: vi.fn(),
      setPayWithWallet: vi.fn(),
      setWalletBalance: vi.fn(),
      walletBalance: 500,
      walletDvaEnabled: true,
      walletLoading: false,
    });

    renderOpenModal();

    expect(
      screen.queryByRole('button', { name: /pay with bank transfer/i })
    ).not.toBeInTheDocument();
  });
});
