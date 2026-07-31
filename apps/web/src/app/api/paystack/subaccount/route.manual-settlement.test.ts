import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MERCHANT_ID,
  getSubaccountRouteMocks,
  makeRequest,
  resetSubaccountRouteMocks,
  subaccountMocks,
} from './subaccount-route.test-utils';

const { POST } = await import('./route');

const mocks = getSubaccountRouteMocks();

function useIndianMerchant() {
  mocks.merchantSingle.mockResolvedValueOnce({
    data: {
      business_name: 'Yodha Shopping',
      country: 'IN',
      email: 'yodhashopping@gmail.com',
      phone: null,
    },
    error: null,
  });
}

describe('POST /api/paystack/subaccount: manual settlements', () => {
  beforeEach(resetSubaccountRouteMocks);

  it('uses the merchant record business name when the payload omits it', async () => {
    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );
    expect(response.status).toBe(200);
    expect(mocks.createSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({ business_name: 'Baci Store' })
    );
  });

  it('returns 400 when neither the payload nor merchant record has a business name', async () => {
    mocks.merchantSingle.mockResolvedValueOnce({
      data: {
        business_name: null,
        email: 'merchant@example.com',
        phone: '08012345678',
      },
      error: null,
    });
    const response = await POST(
      makeRequest({ accountNumber: '1234567890', bankCode: '044' })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Business name is required',
    });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
  });

  it('saves manual invoice bank details for India without calling Paystack', async () => {
    useIndianMerchant();
    const response = await POST(
      makeRequest({
        accountNumber: 'IN-123456789012',
        bankName: 'HDFC Bank',
        accountName: 'Yodha Shopping',
        businessName: 'Yodha Shopping',
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Yodha Shopping',
      subaccountCode: null,
    });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
    expect(mocks.updateSubaccount).not.toHaveBeenCalled();
    expect(subaccountMocks.merchantUpdate).toHaveBeenCalledWith({
      paystack_subaccount_code: null,
      bank_account_number: 'IN-123456789012',
      bank_account_name: 'Yodha Shopping',
      bank_code: null,
      bank_name: 'HDFC Bank',
    });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(subaccountMocks.walletUpdate).not.toHaveBeenCalled();
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `features-${DEFAULT_MERCHANT_ID}`,
      'merchant'
    );
  });

  it('returns saved manual bank details when feature cache invalidation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.revalidateTag.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    useIndianMerchant();
    const response = await POST(
      makeRequest({
        accountNumber: 'IN-123456789012',
        bankName: 'HDFC Bank',
        accountName: 'Yodha Shopping',
        businessName: 'Yodha Shopping',
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Yodha Shopping',
      subaccountCode: null,
    });
    expect(mocks.merchantUpdateEq).toHaveBeenCalled();
  });

  it('rejects placeholder manual invoice bank names for India', async () => {
    useIndianMerchant();
    const response = await POST(
      makeRequest({
        accountNumber: 'IN-123456789012',
        bankName: 'Unknown Bank',
        businessName: 'Yodha Shopping',
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: 'Enter the actual bank name to save manual invoice bank details.',
    });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
    expect(mocks.updateSubaccount).not.toHaveBeenCalled();
    expect(subaccountMocks.merchantUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when bank_code is missing from request payload', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890123456',
        businessName: 'Yodha Shopping',
      })
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('Invalid input');
    expect(body.details.fieldErrors.bank_code).toContain(
      'Bank code is required'
    );
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
    expect(mocks.updateSubaccount).not.toHaveBeenCalled();
    expect(subaccountMocks.merchantUpdate).not.toHaveBeenCalled();
  });

  it('rejects auto-payout changes for India bank details', async () => {
    useIndianMerchant();
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890123456',
        bankName: 'HDFC Bank',
        businessName: 'Yodha Shopping',
        autoPayoutEnabled: true,
      })
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error:
        'Auto-payout settings are only available for Nigerian Paystack settlements',
    });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
    expect(mocks.updateSubaccount).not.toHaveBeenCalled();
    expect(subaccountMocks.merchantUpdate).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(subaccountMocks.walletUpdate).not.toHaveBeenCalled();
  });
});
