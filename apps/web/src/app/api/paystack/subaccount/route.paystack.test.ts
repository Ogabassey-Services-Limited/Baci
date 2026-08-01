import { beforeEach, describe, expect, it } from 'vitest';
import {
  getSubaccountRouteMocks,
  makeRequest,
  resetSubaccountRouteMocks,
  subaccountMocks,
} from './subaccount-route.test-utils';

const { POST } = await import('./route');

const mocks = getSubaccountRouteMocks();

describe('POST /api/paystack/subaccount: Paystack settlements', () => {
  beforeEach(resetSubaccountRouteMocks);

  it('updates an existing subaccount instead of creating a new one', async () => {
    mocks.fetchPaystackSubaccountCode.mockResolvedValueOnce('ACCT_existing123');
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.updateSubaccount).toHaveBeenCalledWith(
      'ACCT_existing123',
      expect.objectContaining({
        business_name: 'Baci Store',
        settlement_bank: '044',
        account_number: '1234567890',
      })
    );
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
  });

  it('does not update wallet settings when auto payout preferences are omitted', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(subaccountMocks.walletUpdate).not.toHaveBeenCalled();
  });

  it('returns 403 when a staff member tries to update auto payout settings', async () => {
    mocks.getMerchantForApiRequest.mockResolvedValueOnce({
      merchantId: '22222222-2222-4222-8222-222222222222',
      staffAccess: { role: 'admin', isOwner: false, isStaff: true },
    });
    mocks.toUserAccess.mockReturnValueOnce({
      merchantId: '22222222-2222-4222-8222-222222222222',
      role: 'admin',
      isOwner: false,
      isStaff: true,
      permissions: { integrations: { manage: true } },
    });
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        autoPayoutEnabled: true,
      })
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'Only merchant owners can update auto-payout settings',
    });
    expect(mocks.resolveAccountNumber).not.toHaveBeenCalled();
    expect(mocks.createSubaccount).not.toHaveBeenCalled();
  });

  it('returns 500 when the wallet update affects no rows', async () => {
    mocks.walletUpdateMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
        autoPayoutEnabled: true,
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Failed to update auto-payout settings',
    });
  });

  it('accepts an alphanumeric bankCode and reaches resolveAccountNumber', async () => {
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: 'MFB50992',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(200);
    expect(mocks.resolveAccountNumber).toHaveBeenCalledWith(
      '1234567890',
      'MFB50992'
    );
  });

  it('maps configuration failures to 500', async () => {
    mocks.resolveAccountNumber.mockResolvedValueOnce({
      success: false,
      error: 'PAYSTACK_SECRET_KEY is not configured',
      code: 'CONFIG_ERROR',
    });
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Service configuration error',
    });
  });

  it('maps upstream subaccount failures to 502', async () => {
    mocks.createSubaccount.mockResolvedValueOnce({
      success: false,
      error: 'Gateway timeout',
      code: 'HTTP_502',
    });
    const response = await POST(
      makeRequest({
        accountNumber: '1234567890',
        bankCode: '044',
        businessName: 'Baci Store',
      })
    );
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: 'Gateway timeout' });
  });
});
