import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mockCookies = vi.fn();
const mockCreateClient = vi.fn();
const mockCheckCsrfProtection = vi.fn();
const mockFormatPhoneNumber = vi.fn();
const mockGenerateRequestRef = vi.fn();
const mockIsValidPhoneNumber = vi.fn();
const mockPurchaseAirtime = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => mockCookies()),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/kuda', () => ({
  NetworkProvider: {
    MTN: 'MTN',
    AIRTEL: 'AIRTEL',
    GLO: 'GLO',
    MOBILE_9: '9MOBILE',
  },
  formatPhoneNumber: (...args: unknown[]) => mockFormatPhoneNumber(...args),
  generateRequestRef: (...args: unknown[]) => mockGenerateRequestRef(...args),
  isValidPhoneNumber: (...args: unknown[]) => mockIsValidPhoneNumber(...args),
  purchaseAirtime: (...args: unknown[]) => mockPurchaseAirtime(...args),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

function createRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/vtu/loyalty/redeem', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

const validBody = {
  rewardId: '11111111-1111-1111-1111-111111111111',
  phoneNumber: '08030000000',
  networkProvider: 'MTN',
} as const;

function createSupabaseMock(options?: {
  authUser?: { id: string; email: string } | null;
  rewardResult?: { data: Record<string, unknown> | null; error: unknown };
  customerResult?: { data: Record<string, unknown> | null; error: unknown };
  vtuInsertResult?: { data: { id: string } | null; error: unknown };
  vtuUpdateResults?: Array<{ error: unknown }>;
  customerUpdateResult?: { error: unknown };
  rewardUpdateResult?: { error: unknown };
  pointsTransactionResult?: { error: unknown };
}) {
  const rewardResult = options?.rewardResult ?? {
    data: {
      merchant_id: 'merchant-1',
      name: 'Airtime Reward',
      points_required: 100,
      airtime_amount: 500,
      network_provider: 'MTN',
      max_total_redemptions: 10,
      total_redemptions: 2,
    },
    error: null,
  };
  const customerResult = options?.customerResult ?? {
    data: { id: 'customer-1', loyalty_points: 250 },
    error: null,
  };
  const vtuInsertResult = options?.vtuInsertResult ?? {
    data: { id: 'tx-1' },
    error: null,
  };
  const vtuUpdateResults = [...(options?.vtuUpdateResults ?? [])];
  const customerUpdates: Record<string, unknown>[] = [];
  const rewardUpdates: Record<string, unknown>[] = [];
  const pointsTransactionInserts: Record<string, unknown>[] = [];

  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: {
          user:
            options?.authUser === undefined
              ? { id: 'user-1', email: 'customer@example.com' }
              : options.authUser,
        },
        error: null,
      }),
    },
    from: vi.fn((table: string) => {
      if (table === 'loyalty_airtime_rewards') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(rewardResult),
        };

        return {
          select: vi.fn(() => query),
          update: vi.fn((payload: Record<string, unknown>) => {
            rewardUpdates.push(payload);
            return {
              eq: vi
                .fn()
                .mockResolvedValue(
                  options?.rewardUpdateResult ?? { error: null }
                ),
            };
          }),
        };
      }

      if (table === 'customers') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue(customerResult),
        };

        return {
          select: vi.fn(() => query),
          update: vi.fn((payload: Record<string, unknown>) => {
            customerUpdates.push(payload);
            return {
              eq: vi
                .fn()
                .mockResolvedValue(
                  options?.customerUpdateResult ?? { error: null }
                ),
            };
          }),
        };
      }

      if (table === 'vtu_transactions') {
        return {
          insert: vi.fn(() => ({
            select: vi.fn(() => ({
              single: vi.fn().mockResolvedValue(vtuInsertResult),
            })),
          })),
          update: vi.fn(() => ({
            eq: vi
              .fn()
              .mockResolvedValue(vtuUpdateResults.shift() ?? { error: null }),
          })),
        };
      }

      if (table === 'points_transactions') {
        return {
          insert: vi.fn((payload: Record<string, unknown>) => {
            pointsTransactionInserts.push(payload);
            return options?.pointsTransactionResult ?? { error: null };
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
  };

  return {
    supabase,
    customerUpdates,
    rewardUpdates,
    pointsTransactionInserts,
  };
}

describe('POST /api/vtu/loyalty/redeem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCookies.mockReturnValue({ get: vi.fn() });
    mockCheckCsrfProtection.mockResolvedValue({ valid: true });
    mockFormatPhoneNumber.mockImplementation((value: string) => value);
    mockGenerateRequestRef.mockReturnValue('req-123');
    mockIsValidPhoneNumber.mockReturnValue(true);
    mockPurchaseAirtime.mockResolvedValue({
      success: true,
      transactionId: 'provider-tx-1',
    });
  });

  it('returns 403 when CSRF validation fails', async () => {
    const { supabase } = createSupabaseMock();
    mockCreateClient.mockReturnValue(supabase);
    mockCheckCsrfProtection.mockResolvedValue({
      valid: false,
      response: NextResponse.json(
        { error: 'Invalid CSRF token' },
        { status: 403 }
      ),
    });

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error).toBe('Invalid CSRF token');
  });

  it('returns 400 when the request body fails schema validation', async () => {
    const { supabase } = createSupabaseMock();
    mockCreateClient.mockReturnValue(supabase);

    const response = await POST(
      createRequest({
        rewardId: 'not-a-uuid',
        phoneNumber: '',
        networkProvider: 'INVALID',
      })
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Invalid request');
  });

  it('returns 400 when the customer has insufficient points', async () => {
    const { supabase } = createSupabaseMock({
      customerResult: {
        data: { id: 'customer-1', loyalty_points: 25 },
        error: null,
      },
    });
    mockCreateClient.mockReturnValue(supabase);

    const response = await POST(createRequest(validBody));

    expect(response.status).toBe(400);
    expect(mockPurchaseAirtime).not.toHaveBeenCalled();
  });

  it('returns 400 when the airtime provider rejects the purchase', async () => {
    const { supabase } = createSupabaseMock();
    mockCreateClient.mockReturnValue(supabase);
    mockPurchaseAirtime.mockResolvedValueOnce({
      success: false,
      message: 'Provider unavailable',
    });

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Provider unavailable');
  });

  it('returns success with a reconciliation warning when deducting points fails after a successful purchase', async () => {
    const { supabase, pointsTransactionInserts, rewardUpdates } =
      createSupabaseMock({
        customerUpdateResult: { error: { message: 'write failed' } },
      });
    mockCreateClient.mockReturnValue(supabase);

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.reconciliationPending).toBe(true);
    expect(rewardUpdates).toHaveLength(0);
    expect(pointsTransactionInserts).toHaveLength(0);
  });

  it('returns 200 and keeps the success response when points logging fails', async () => {
    const {
      supabase,
      customerUpdates,
      pointsTransactionInserts,
      rewardUpdates,
    } = createSupabaseMock({
      pointsTransactionResult: { error: { message: 'ledger write failed' } },
    });
    mockCreateClient.mockReturnValue(supabase);

    const response = await POST(createRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(customerUpdates).toEqual([{ loyalty_points: 150 }]);
    expect(rewardUpdates).toEqual([{ total_redemptions: 3 }]);
    expect(pointsTransactionInserts).toEqual([
      expect.objectContaining({
        type: 'redeem',
        source: 'redemption',
        balance_after: 150,
      }),
    ]);
  });
});
