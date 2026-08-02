import type { NextRequest } from 'next/server';
import { vi } from 'vitest';

export const DEFAULT_MERCHANT_ID = '22222222-2222-4222-8222-222222222222';

const mocks = vi.hoisted(() => ({
  authenticateApiRequest: vi.fn(),
  checkCsrfProtection: vi.fn(),
  createSubaccount: vi.fn(),
  fetchPaystackSubaccountCode: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  merchantSingle: vi.fn(),
  merchantUpdateEq: vi.fn(),
  revalidateTag: vi.fn(),
  resolveAccountNumber: vi.fn(),
  rpc: vi.fn(),
  toUserAccess: vi.fn(),
  updateSubaccount: vi.fn(),
  walletUpdateMaybeSingle: vi.fn(),
}));

export function getSubaccountRouteMocks() {
  return mocks;
}

const merchantUpdate = vi.fn(() => ({ eq: mocks.merchantUpdateEq }));
const merchantSelectEq = vi.fn(() => ({ single: mocks.merchantSingle }));
const merchantSelect = vi.fn(() => ({ eq: merchantSelectEq }));
const walletUpdateSelect = vi.fn(() => ({
  maybeSingle: mocks.walletUpdateMaybeSingle,
}));
const walletUpdateEq = vi.fn(() => ({ select: walletUpdateSelect }));
const walletUpdate = vi.fn(() => ({ eq: walletUpdateEq }));

export const mockSupabase = {
  from: vi.fn((table: string) => {
    if (table === 'merchants') {
      return { select: merchantSelect, update: merchantUpdate };
    }
    if (table === 'merchant_wallets') return { update: walletUpdate };
    throw new Error(`Unexpected table ${table}`);
  }),
  rpc: mocks.rpc,
};

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mocks.authenticateApiRequest(...args),
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));
vi.mock('next/cache', () => ({
  revalidateTag: (...args: unknown[]) => mocks.revalidateTag(...args),
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
  toUserAccess: (...args: unknown[]) => mocks.toUserAccess(...args),
}));
vi.mock('@/lib/paystack', () => ({
  createSubaccount: (...args: unknown[]) => mocks.createSubaccount(...args),
  resolveAccountNumber: (...args: unknown[]) =>
    mocks.resolveAccountNumber(...args),
  updateSubaccount: (...args: unknown[]) => mocks.updateSubaccount(...args),
}));
vi.mock('@/lib/fetch-merchant-payment-secret', () => ({
  fetchMerchantPaystackSubaccountCode: (...args: unknown[]) =>
    mocks.fetchPaystackSubaccountCode(...args),
}));

export function makeRequest(
  body: string | Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  const requestBody =
    typeof body === 'string'
      ? body
      : { merchantId: DEFAULT_MERCHANT_ID, ...body };
  return new Request('http://localhost/api/paystack/subaccount', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body:
      typeof requestBody === 'string'
        ? requestBody
        : JSON.stringify(requestBody),
  }) as unknown as NextRequest;
}

export function resetSubaccountRouteMocks() {
  vi.clearAllMocks();
  mocks.fetchPaystackSubaccountCode.mockResolvedValue(null);
  mocks.authenticateApiRequest.mockResolvedValue({
    user: { id: 'user-123', email: 'owner@example.com' },
    error: null,
    supabase: mockSupabase,
  });
  mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
  mocks.getMerchantForApiRequest.mockResolvedValue({
    merchantId: DEFAULT_MERCHANT_ID,
    staffAccess: { role: 'owner', isOwner: true, isStaff: false },
  });
  mocks.toUserAccess.mockReturnValue({
    merchantId: DEFAULT_MERCHANT_ID,
    role: 'owner',
    isOwner: true,
    isStaff: false,
    permissions: {},
  });
  mocks.hasPermission.mockReturnValue(true);
  mocks.merchantSingle.mockResolvedValue({
    data: {
      business_name: 'Baci Store',
      country: 'NG',
      email: 'merchant@example.com',
      phone: '08012345678',
    },
    error: null,
  });
  mocks.merchantUpdateEq.mockResolvedValue({ error: null });
  mocks.walletUpdateMaybeSingle.mockResolvedValue({
    data: { id: 'wallet-123' },
    error: null,
  });
  mocks.rpc.mockResolvedValue({ data: 'wallet-123', error: null });
  mocks.resolveAccountNumber.mockResolvedValue({
    success: true,
    data: { account_name: 'Jane Doe', account_number: '1234567890' },
  });
  mocks.createSubaccount.mockResolvedValue({
    success: true,
    data: { subaccount_code: 'ACCT_new123' },
  });
  mocks.updateSubaccount.mockResolvedValue({
    success: true,
    data: { subaccount_code: 'ACCT_existing123' },
  });
}

export const subaccountMocks = {
  merchantSelect,
  merchantSelectEq,
  merchantUpdate,
  walletUpdate,
};
