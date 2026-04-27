import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from './route';

const mockNotifyCustomer = vi.fn().mockResolvedValue({
  errors: [],
  failed: 0,
  sent: 1,
});
const mockAttemptMaybeSingle = vi.fn();
const mockRange = vi.fn();
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });

vi.mock('@/env', () => ({
  getCronSecret: () => process.env.CRON_SECRET,
}));

vi.mock('@/lib/expo-push', () => ({
  notifyCustomer: (...args: unknown[]) => mockNotifyCustomer(...args),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: vi.fn((table: string) => {
      if (table === 'push_notification_attempts') {
        const attemptSelectBuilder = {
          eq: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          limit: vi
            .fn()
            .mockReturnValue({ maybeSingle: mockAttemptMaybeSingle }),
        };

        return {
          select: vi.fn().mockReturnValue(attemptSelectBuilder),
        };
      }

      if (table !== 'customer_wallet_transactions') {
        throw new Error(`Unexpected table: ${table}`);
      }

      const selectBuilder = {
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        lt: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: mockRange,
      };

      return {
        select: vi.fn().mockReturnValue(selectBuilder),
        update: vi.fn().mockReturnValue({
          eq: mockUpdateEq,
        }),
      };
    }),
  }),
}));

function createRequest(
  auth = 'Bearer test-cron-secret',
  url = 'http://localhost:3000/api/cron/vtu-cashback-summaries?now=2026-04-27T12%3A00%3A00.000Z'
) {
  return new NextRequest(url, {
    method: 'GET',
    headers: auth ? { Authorization: auth } : {},
  });
}

describe('GET /api/cron/vtu-cashback-summaries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'test-cron-secret';
    mockAttemptMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockRange.mockResolvedValue({ data: [], error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('returns 401 when Authorization header is missing', async () => {
    const response = await GET(createRequest(''));

    expect(response.status).toBe(401);
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('returns 401 when Authorization header is invalid', async () => {
    const response = await GET(createRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('returns 400 when now query parameter is malformed', async () => {
    const response = await GET(
      createRequest(
        'Bearer test-cron-secret',
        'http://localhost:3000/api/cron/vtu-cashback-summaries?now=invalid-date'
      )
    );

    expect(response.status).toBe(400);
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('sends one monthly cashback summary per customer merchant group', async () => {
    mockRange.mockResolvedValueOnce({
      data: [
        {
          amount: 500,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-1',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
        {
          amount: 250,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-2',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
      ],
      error: null,
    });

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      groupsProcessed: 1,
      period: '2026-03',
      summariesSent: 1,
      transactionsMarked: 2,
    });
    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-1',
      'Your OgaBassey bill rewards',
      'Ada, OgaBassey added ₦750 to your wallet from 2 bill purchases in March 2026.',
      expect.objectContaining({
        amount: 750,
        merchant_id: 'merchant-1',
        merchant_slug: 'ogabassey',
        period: '2026-03',
        transaction_count: 2,
        idempotency_key: 'vtu-cashback-summary:2026-03:customer-1:merchant-1',
        type: 'vtu_cashback_monthly_summary',
      }),
      'promotions'
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'tx-1');
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'tx-2');
  });

  it('sends a separate summary for each customer merchant pair', async () => {
    mockRange.mockResolvedValueOnce({
      data: [
        {
          amount: 500,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-1',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
        {
          amount: 300,
          customer: { first_name: 'Ben', user_id: 'user-2' },
          customer_id: 'customer-2',
          id: 'tx-2',
          merchant: { business_name: 'Other Store', slug: 'other-store' },
          merchant_id: 'merchant-2',
          metadata: {},
        },
      ],
      error: null,
    });

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      groupsProcessed: 2,
      period: '2026-03',
      summariesSent: 2,
      transactionsMarked: 2,
    });
    expect(mockNotifyCustomer).toHaveBeenCalledTimes(2);
    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-1',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        idempotency_key: 'vtu-cashback-summary:2026-03:customer-1:merchant-1',
        merchant_id: 'merchant-1',
        period: '2026-03',
      }),
      'promotions'
    );
    expect(mockNotifyCustomer).toHaveBeenCalledWith(
      'user-2',
      expect.any(String),
      expect.any(String),
      expect.objectContaining({
        idempotency_key: 'vtu-cashback-summary:2026-03:customer-2:merchant-2',
        merchant_id: 'merchant-2',
        period: '2026-03',
      }),
      'promotions'
    );
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'tx-1');
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'tx-2');
  });

  it('returns no-op response when there are no cashback rows', async () => {
    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      groupsProcessed: 0,
      period: '2026-03',
      summariesFailed: 0,
      summariesSent: 0,
      transactionsMarked: 0,
    });
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('returns 500 when loading cashback rows fails', async () => {
    mockRange.mockResolvedValueOnce({
      data: null,
      error: { message: 'DB error' },
    });

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to load cashback rows' });
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
  });

  it('reports summary failures when marking rows fails after notifying', async () => {
    mockRange.mockResolvedValueOnce({
      data: [
        {
          amount: 500,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-1',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
      ],
      error: null,
    });
    mockUpdateEq.mockResolvedValueOnce({
      error: { message: 'mark failed' },
    });

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      errors: ['1 summary row updates failed: mark failed'],
      summariesFailed: 1,
      summariesSent: 0,
      transactionsMarked: 0,
    });
    expect(mockNotifyCustomer).toHaveBeenCalled();
  });

  it('reports notification failures after rows are claimed', async () => {
    mockRange.mockResolvedValueOnce({
      data: [
        {
          amount: 500,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-1',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
      ],
      error: null,
    });
    mockNotifyCustomer.mockResolvedValueOnce({
      errors: ['push failed'],
      failed: 1,
      sent: 0,
    });

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      errors: ['push failed'],
      summariesFailed: 1,
      summariesSent: 0,
      transactionsMarked: 0,
    });
    expect(mockNotifyCustomer).toHaveBeenCalled();
    expect(mockUpdateEq).not.toHaveBeenCalled();
  });

  it('does not resend when a completed notification attempt already exists', async () => {
    mockAttemptMaybeSingle.mockResolvedValueOnce({
      data: { id: 'attempt-1' },
      error: null,
    });
    mockRange.mockResolvedValueOnce({
      data: [
        {
          amount: 500,
          customer: { first_name: 'Ada', user_id: 'user-1' },
          customer_id: 'customer-1',
          id: 'tx-1',
          merchant: { business_name: 'OgaBassey', slug: 'ogabassey' },
          merchant_id: 'merchant-1',
          metadata: {},
        },
      ],
      error: null,
    });

    const response = await GET(createRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      summariesFailed: 0,
      summariesSent: 1,
      transactionsMarked: 1,
    });
    expect(mockNotifyCustomer).not.toHaveBeenCalled();
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'tx-1');
  });
});
