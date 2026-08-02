import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MERCHANT_ID,
  getSubaccountRouteMocks,
  makeRequest,
  mockSupabase,
  resetSubaccountRouteMocks,
  subaccountMocks,
} from './subaccount-route.test-utils';

const { POST } = await import('./route');

const mocks = getSubaccountRouteMocks();

describe('POST /api/paystack/subaccount: tenant selection and cache revalidation', () => {
  beforeEach(resetSubaccountRouteMocks);

  it('authorizes and writes only the merchant explicitly selected by the request', async () => {
    const merchantId = '33333333-3333-4333-8333-333333333333';
    mocks.getMerchantForApiRequest.mockResolvedValueOnce({
      merchantId,
      staffAccess: { role: 'owner', isOwner: true, isStaff: false },
    });
    mocks.toUserAccess.mockReturnValueOnce({
      merchantId,
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: {},
    });
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        merchantId,
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      { requestedMerchantId: merchantId }
    );
    expect(subaccountMocks.merchantSelectEq).toHaveBeenCalledWith(
      'id',
      merchantId
    );
    expect(mocks.merchantUpdateEq).toHaveBeenCalledWith('id', merchantId);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `features-${merchantId}`,
      'merchant'
    );
  });

  it('creates a new subaccount and persists the resolved details', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        autoPayoutEnabled: true,
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Jane Doe',
      subaccountCode: 'ACCT_new123',
    });
    expect(mocks.resolveAccountNumber).toHaveBeenCalledWith(
      '1234567890',
      '044'
    );
    expect(mocks.createSubaccount).toHaveBeenCalledWith(
      expect.objectContaining({
        business_name: 'Baci Store',
        settlement_bank: '044',
        account_number: '1234567890',
      })
    );
    expect(subaccountMocks.merchantUpdate).toHaveBeenCalledWith({
      paystack_subaccount_code: 'ACCT_new123',
      bank_account_number: '1234567890',
      bank_account_name: 'Jane Doe',
      bank_code: '044',
      bank_name: 'Unknown Bank',
    });
    expect(mocks.rpc).toHaveBeenCalledWith('get_or_create_merchant_wallet', {
      p_merchant_id: DEFAULT_MERCHANT_ID,
    });
    expect(subaccountMocks.walletUpdate).toHaveBeenCalledWith({
      auto_payout_enabled: true,
    });
    expect(mocks.revalidateTag).toHaveBeenCalledWith(
      `features-${DEFAULT_MERCHANT_ID}`,
      'merchant'
    );
  });

  it('reads non-secret merchant fields for the selected merchant and the subaccount code through the bounded helper', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      mockSupabase,
      'user-123',
      { requestedMerchantId: DEFAULT_MERCHANT_ID }
    );
    expect(mocks.hasPermission).toHaveBeenCalled();
    expect(subaccountMocks.merchantSelect).toHaveBeenCalledWith(
      'business_name, country, email, phone'
    );
    expect(subaccountMocks.merchantSelectEq).toHaveBeenCalledWith(
      'id',
      DEFAULT_MERCHANT_ID
    );
    expect(mocks.fetchPaystackSubaccountCode).toHaveBeenCalledWith(
      mockSupabase,
      DEFAULT_MERCHANT_ID
    );
  });

  it('does not read merchant data before authorization passes', async () => {
    mocks.hasPermission.mockReturnValueOnce(false);
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(403);
    expect(subaccountMocks.merchantSelect).not.toHaveBeenCalled();
    expect(mocks.fetchPaystackSubaccountCode).not.toHaveBeenCalled();
  });

  it('returns the saved subaccount when feature cache invalidation fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.revalidateTag.mockImplementationOnce(() => {
      throw new Error('cache unavailable');
    });
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      success: true,
      accountName: 'Jane Doe',
      subaccountCode: 'ACCT_new123',
    });
    expect(mocks.merchantUpdateEq).toHaveBeenCalled();
  });
});
