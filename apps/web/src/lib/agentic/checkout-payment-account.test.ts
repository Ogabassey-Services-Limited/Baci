import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createAgenticCheckoutPaymentAccount } from '@/lib/agentic/checkout-payment-account';
import { createDedicatedVirtualAccount } from '@/lib/agentic/paystack';

vi.mock('@/lib/agentic/paystack', () => ({
  createDedicatedVirtualAccount: vi.fn(),
}));

const mockCreateDedicatedVirtualAccount = vi.mocked(
  createDedicatedVirtualAccount
);

const buyer = {
  email: 'buyer@example.com',
  first_name: 'Ada',
  last_name: 'Lovelace',
  phone_number: '+2348012345678',
};

describe('createAgenticCheckoutPaymentAccount', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a dedicated virtual account from buyer details', async () => {
    const account = {
      account_name: 'Ada Lovelace',
      account_number: '1234567890',
      assigned: true,
      bank_name: 'Wema Bank',
      currency: 'NGN',
    };
    mockCreateDedicatedVirtualAccount.mockResolvedValue(account);

    const result = await createAgenticCheckoutPaymentAccount({
      buyer,
      paystackSubaccountCode: 'ACCT_TESTMOCK1234567',
    });

    expect(result).toEqual({ account, ok: true });
    expect(mockCreateDedicatedVirtualAccount).toHaveBeenCalledWith(
      {
        email: buyer.email,
        first_name: buyer.first_name,
        last_name: buyer.last_name,
        phone: buyer.phone_number,
      },
      { subaccount: 'ACCT_TESTMOCK1234567' }
    );
  });

  it('returns a safe failure result when account creation fails', async () => {
    const error = new Error('Paystack unavailable');
    mockCreateDedicatedVirtualAccount.mockRejectedValue(error);

    const result = await createAgenticCheckoutPaymentAccount({
      buyer,
      paystackSubaccountCode: 'ACCT_TESTMOCK1234567',
    });

    expect(result).toEqual({
      error,
      errorMessage: 'Paystack unavailable',
      ok: false,
    });
  });

  it('fails closed when the merchant subaccount is blank after trimming', async () => {
    const result = await createAgenticCheckoutPaymentAccount({
      buyer,
      paystackSubaccountCode: '   ',
    });

    expect(result).toEqual({
      error: expect.any(Error),
      errorMessage: 'Merchant Paystack subaccount is not configured',
      ok: false,
    });
    expect(mockCreateDedicatedVirtualAccount).not.toHaveBeenCalled();
  });

  it('fails closed when the merchant subaccount is null', async () => {
    const result = await createAgenticCheckoutPaymentAccount({
      buyer,
      paystackSubaccountCode: null,
    });

    expect(result).toEqual({
      error: expect.any(Error),
      errorMessage: 'Merchant Paystack subaccount is not configured',
      ok: false,
    });
    expect(mockCreateDedicatedVirtualAccount).not.toHaveBeenCalled();
  });

  it('returns the fallback failure message for non-error rejections', async () => {
    mockCreateDedicatedVirtualAccount.mockRejectedValue('network timeout');

    const result = await createAgenticCheckoutPaymentAccount({
      buyer,
      paystackSubaccountCode: 'ACCT_TESTMOCK1234567',
    });

    expect(result).toEqual({
      error: 'network timeout',
      errorMessage: 'Failed to create payment account',
      ok: false,
    });
  });
});
