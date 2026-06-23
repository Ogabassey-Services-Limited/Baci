import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  loggerError: vi.fn(),
  loggerInfo: vi.fn(),
  sendPayout: vi.fn(),
  updateRecords: [] as Array<{
    filters: [string, unknown][];
    payload: Record<string, unknown>;
    table: string;
  }>,
}));

vi.mock('nanoid', () => ({
  nanoid: () => 'fixed-ref-12',
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({}),
}));

vi.mock('@/lib/api-auth', () => ({
  hasPermission: (...args: unknown[]) => mocks.hasPermission(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) =>
    mocks.checkCsrfProtection(...args),
}));

vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: (...args: unknown[]) =>
    mocks.getMerchantForApiRequest(...args),
  toUserAccess: vi.fn(() => ({ role: 'owner' })),
}));

vi.mock('@/lib/korapay', () => ({
  sendPayout: (...args: unknown[]) => mocks.sendPayout(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mocks.loggerError(...args),
    info: (...args: unknown[]) => mocks.loggerInfo(...args),
  },
}));

function createUpdateQuery(table: string, payload: Record<string, unknown>) {
  const record = { table, payload, filters: [] as [string, unknown][] };
  mocks.updateRecords.push(record);

  return {
    eq(column: string, value: unknown) {
      record.filters.push([column, value]);
      return record.filters.length >= 2
        ? Promise.resolve({ error: null })
        : this;
    },
  };
}

function createPayoutRequestsTable() {
  return {
    insert: vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'payout-request-1' },
          error: null,
        }),
      })),
    })),
    update: vi.fn((payload: Record<string, unknown>) =>
      createUpdateQuery('payout_requests', payload)
    ),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    })),
  };
}

function createMerchantsTable() {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { email: 'merchant@example.com' },
          error: null,
        }),
      })),
    })),
  };
}

function createTransactionsTable() {
  return {
    insert: vi.fn().mockResolvedValue({ error: null }),
  };
}

function createSupabaseMock() {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'merchants') return createMerchantsTable();
      if (table === 'payout_requests') return createPayoutRequestsTable();
      if (table === 'transactions') return createTransactionsTable();
      throw new Error(`Unexpected table: ${table}`);
    }),
    rpc: vi.fn().mockResolvedValue({ data: 25_000, error: null }),
  };
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => createSupabaseMock()),
}));

const { POST } = await import('./route');

function createRequest() {
  return new NextRequest('http://localhost/api/payouts/request', {
    body: JSON.stringify({
      amount: 10_000,
      currency: 'NGN',
      bank_code: '044',
      account_number: '0123456789',
    }),
    method: 'POST',
  });
}

describe('POST /api/payouts/request', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.updateRecords.length = 0;
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.getMerchantForApiRequest.mockResolvedValue({
      businessName: 'Scoped Merchant',
      merchantId: 'merchant-1',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.sendPayout.mockResolvedValue({
      success: true,
      data: { status: 'success', provider_reference: 'korapay-1' },
    });
  });

  it('scopes the successful payout request update to the merchant', async () => {
    const response = await POST(createRequest());

    expect(response.status).toBe(200);
    expect(mocks.updateRecords).toEqual([
      expect.objectContaining({
        table: 'payout_requests',
        filters: [
          ['id', 'payout-request-1'],
          ['merchant_id', 'merchant-1'],
        ],
        payload: expect.objectContaining({ status: 'completed' }),
      }),
    ]);
  });

  it('scopes the failed payout request update to the merchant', async () => {
    mocks.sendPayout.mockRejectedValueOnce(new Error('Korapay unavailable'));

    const response = await POST(createRequest());
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toBe('Failed to process payout');
    expect(mocks.updateRecords).toEqual([
      expect.objectContaining({
        table: 'payout_requests',
        filters: [
          ['id', 'payout-request-1'],
          ['merchant_id', 'merchant-1'],
        ],
        payload: expect.objectContaining({
          failure_reason: 'Korapay unavailable',
          status: 'failed',
        }),
      }),
    ]);
  });
});
