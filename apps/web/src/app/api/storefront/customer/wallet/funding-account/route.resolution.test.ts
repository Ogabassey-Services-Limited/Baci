import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockEnsureCustomerWalletPaymentAccount = vi.fn();
const mockResolveCustomerWalletPaymentAccount = vi.fn();
const mockResolveVtuCustomer = vi.fn();
const mockResolveWalletTopUpMerchant = vi.fn();
const mockFetchPaystackSubaccountCode = vi.fn();
const mockRpc = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/resolve-wallet-top-up-merchant', () => ({
  resolveWalletTopUpMerchant: (...args: unknown[]) =>
    mockResolveWalletTopUpMerchant(...args),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  resolveVtuCustomer: (...args: unknown[]) => mockResolveVtuCustomer(...args),
}));

vi.mock('@/lib/customer-wallet-payment-accounts', () => ({
  CustomerWalletPaymentAccountError: class CustomerWalletPaymentAccountError extends Error {
    code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = 'CustomerWalletPaymentAccountError';
      this.code = code;
    }
  },
  ensureCustomerWalletPaymentAccount: (...args: unknown[]) =>
    mockEnsureCustomerWalletPaymentAccount(...args),
  resolveCustomerWalletPaymentAccount: (...args: unknown[]) =>
    mockResolveCustomerWalletPaymentAccount(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({ role: 'server-verified-payment-account' })),
}));

vi.mock('@/lib/fetch-merchant-payment-secret', () => ({
  fetchMerchantPaystackSubaccountCode: (...args: unknown[]) =>
    mockFetchPaystackSubaccountCode(...args),
}));

import { GET, POST } from './route';
import {
  customer,
  getRequest,
  merchant,
  postRequest,
} from './route.test-utils';

describe('/api/storefront/customer/wallet/funding-account resolution failures', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { authScope: 'customer', rpc: mockRpc },
      user: { id: 'user-1', email: 'jane@example.com' },
    });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockResolveWalletTopUpMerchant.mockResolvedValue(merchant);
    mockResolveVtuCustomer.mockResolvedValue(customer);
    mockFetchPaystackSubaccountCode.mockResolvedValue(
      merchant.paystack_subaccount_code
    );
    mockRpc.mockResolvedValue({ data: true, error: null });
  });

  it('returns 404 on GET when the merchant cannot be resolved', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValue(null);

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/funding-account?merchantSlug=missing-store'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Merchant not found' });
    expect(mockResolveVtuCustomer).not.toHaveBeenCalled();
    expect(mockResolveCustomerWalletPaymentAccount).not.toHaveBeenCalled();
  });

  it('returns 404 on GET when the customer cannot be resolved', async () => {
    mockResolveVtuCustomer.mockResolvedValue(null);

    const response = await GET(
      getRequest(
        'http://localhost:3000/api/storefront/customer/wallet/funding-account?merchantSlug=ogabassey'
      )
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Customer not found' });
    expect(mockResolveVtuCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1' })
    );
    expect(mockResolveCustomerWalletPaymentAccount).not.toHaveBeenCalled();
  });

  it('returns 404 on POST when the merchant cannot be resolved', async () => {
    mockResolveWalletTopUpMerchant.mockResolvedValue(null);

    const response = await POST(
      postRequest({
        consent: true,
        merchantSlug: 'missing-store',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Merchant not found' });
    expect(mockResolveVtuCustomer).not.toHaveBeenCalled();
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockEnsureCustomerWalletPaymentAccount).not.toHaveBeenCalled();
  });

  it('returns 404 on POST when the customer cannot be resolved', async () => {
    mockResolveVtuCustomer.mockResolvedValue(null);

    const response = await POST(
      postRequest({
        consent: true,
        merchantSlug: 'ogabassey',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body).toEqual({ error: 'Customer not found' });
    expect(mockResolveVtuCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ merchantId: 'merchant-1' })
    );
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockEnsureCustomerWalletPaymentAccount).not.toHaveBeenCalled();
  });
});
