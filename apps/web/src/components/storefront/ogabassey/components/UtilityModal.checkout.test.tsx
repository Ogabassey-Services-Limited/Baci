import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { utilityModalTestHarness as harness } from './utility-modal-test-support';
import { UtilityModal } from './UtilityModal';

function submitAirtimePurchase() {
  render(
    <UtilityModal
      isOpen={true}
      onClose={harness.onClose}
    />
  );
  fireEvent.click(screen.getByText('Mock Submit'));
}

describe('UtilityModal checkout routing', () => {
  beforeEach(() => {
    harness.reset();
  });

  it('sends full wallet coverage to wallet-only checkout with idempotency', async () => {
    const setWalletBalance = vi.fn();
    harness.useWallet.mockReturnValue({
      payWithWallet: true,
      setPayWithWallet: vi.fn(),
      setWalletBalance,
      walletBalance: 500,
      walletLoading: false,
    });

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.checkoutFetch).toHaveBeenCalledWith(
        '/api/vtu/checkout/wallet-only',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Idempotency-Key': expect.any(String) },
          body: expect.any(String),
        })
      );
    });
    expect(JSON.parse(String(harness.checkoutFetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      amount: 100,
      merchantSlug: 'ogabassey',
      type: 'airtime',
      walletAmount: 100,
    });
    expect(setWalletBalance).toHaveBeenCalledWith(400);
  });

  it('sends partial wallet coverage to Paystack for the residual', async () => {
    harness.amount.current = 1000;
    harness.checkoutFetch.mockResolvedValue(
      harness.createJsonResponse({
        checkout_url: 'https://checkout.example/pay',
        reference: 'VTU-GATEWAY',
      })
    );

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.checkoutFetch).toHaveBeenCalledWith(
        '/api/vtu/checkout/initialize',
        expect.objectContaining({ method: 'POST' })
      );
    });
    expect(JSON.parse(String(harness.checkoutFetch.mock.calls[0]?.[1]?.body))).toMatchObject({
      amount: 1000,
      gateway: 'paystack',
      merchantSlug: 'ogabassey',
      walletAmount: 500,
    });
    expect(harness.redirect).toHaveBeenCalledWith('https://checkout.example/pay');
  });

  it('does not apply wallet credit when the customer chooses card', async () => {
    harness.useWallet.mockReturnValue({
      payWithWallet: false,
      setPayWithWallet: vi.fn(),
      setWalletBalance: vi.fn(),
      walletBalance: 500,
      walletLoading: false,
    });
    harness.checkoutFetch.mockResolvedValue(
      harness.createJsonResponse({ checkout_url: 'https://checkout.example/pay' })
    );

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.checkoutFetch).toHaveBeenCalled();
    });
    expect(JSON.parse(String(harness.checkoutFetch.mock.calls[0]?.[1]?.body))).not.toHaveProperty(
      'walletAmount'
    );
  });

  it('requires a signed-in customer before starting checkout', async () => {
    harness.useAuth.mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isLoading: false,
      user: null,
    });

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.toast).toHaveBeenCalledWith({
        title: 'Sign in required',
        description: 'Please sign in to use utility checkout.',
        variant: 'destructive',
      });
    });
    expect(harness.checkoutFetch).not.toHaveBeenCalled();
  });

  it('waits for authentication resolution before starting checkout', async () => {
    harness.useAuth.mockReturnValue({
      customer: null,
      isAuthenticated: false,
      isLoading: true,
      user: null,
    });

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.toast).toHaveBeenCalledWith({
        title: 'Checking account',
        description: 'Please wait while we confirm your session.',
      });
    });
    expect(harness.checkoutFetch).not.toHaveBeenCalled();
  });

  it('surfaces JSON checkout failures', async () => {
    harness.checkoutFetch.mockResolvedValue(
      harness.createJsonResponse({ error: 'Insufficient funds' }, { ok: false, status: 400 })
    );

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.toast).toHaveBeenCalledWith({
        title: 'Transaction Failed',
        description: 'Insufficient funds',
        variant: 'destructive',
      });
    });
  });

  it('rejects failed non-JSON checkout responses', async () => {
    harness.checkoutFetch.mockResolvedValue({
      ok: false,
      status: 502,
      text: () => Promise.resolve('<html>Bad gateway</html>'),
    } as Response);

    submitAirtimePurchase();

    await waitFor(() => {
      expect(harness.toast).toHaveBeenCalledWith({
        title: 'Transaction Failed',
        description: 'Payment checkout failed (502)',
        variant: 'destructive',
      });
    });
    expect(screen.queryByText('Success!')).not.toBeInTheDocument();
  });
});
