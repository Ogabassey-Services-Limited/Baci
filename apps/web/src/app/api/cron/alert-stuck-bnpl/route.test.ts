import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getCronSecret: vi.fn<() => string | undefined>(() => 'cron-secret'),
  limit: vi.fn(),
  statusIn: vi.fn(),
  lt: vi.fn(),
  gte: vi.fn(),
  transactionsIn: vi.fn(),
  notifyMerchant: vi.fn(),
  loggerWarn: vi.fn(),
  loggerError: vi.fn(),
}));

vi.mock('@/env', () => ({
  getCronSecret: mocks.getCronSecret,
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => {
    const ordersChain = {
      select: vi.fn(),
      eq: vi.fn(),
      in: mocks.statusIn,
      lt: mocks.lt,
      gte: mocks.gte,
      order: vi.fn(),
      limit: mocks.limit,
    };
    ordersChain.select.mockReturnValue(ordersChain);
    ordersChain.eq.mockReturnValue(ordersChain);
    mocks.statusIn.mockReturnValue(ordersChain);
    mocks.lt.mockReturnValue(ordersChain);
    mocks.gte.mockReturnValue(ordersChain);
    ordersChain.order.mockReturnValue(ordersChain);

    const transactionsChain = {
      select: vi.fn(),
      in: mocks.transactionsIn,
    };
    transactionsChain.select.mockReturnValue(transactionsChain);

    return {
      from: vi.fn((table: string) =>
        table === 'transactions' ? transactionsChain : ordersChain
      ),
    };
  },
}));

vi.mock('@/lib/expo-push', () => ({
  notifyMerchant: (...args: unknown[]) => mocks.notifyMerchant(...args),
  formatCurrency: (amount: number) => `₦${amount.toLocaleString()}`,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: (...args: unknown[]) => mocks.loggerWarn(...args),
    error: (...args: unknown[]) => mocks.loggerError(...args),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

import { GET } from './route';

function createCronRequest(auth: string | null = 'Bearer cron-secret') {
  return new NextRequest('http://localhost:3000/api/cron/alert-stuck-bnpl', {
    headers: auth ? { authorization: auth } : {},
    method: 'GET',
  });
}

function stuckOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'order-1',
    order_number: 'ORD-1',
    merchant_id: 'merchant-1',
    total: 100000,
    payment_method: 'credit_direct',
    payment_status: 'bnpl_pending',
    updated_at: '2026-07-01T00:00:00.000Z',
    notes: '{"credit_directTransactionId":"txn-1"}',
    ...overrides,
  };
}

describe('GET /api/cron/alert-stuck-bnpl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getCronSecret.mockReturnValue('cron-secret');
    mocks.notifyMerchant.mockResolvedValue({ sent: 1, failed: 0, errors: [] });
    mocks.limit.mockResolvedValue({ data: [], error: null });
    mocks.transactionsIn.mockResolvedValue({ data: [], error: null });
  });

  it('returns 401 when the cron secret does not match', async () => {
    const response = await GET(createCronRequest('Bearer wrong-secret'));

    expect(response.status).toBe(401);
    expect(mocks.limit).not.toHaveBeenCalled();
  });

  it('returns 401 when the authorization header is missing', async () => {
    const response = await GET(createCronRequest(null));

    expect(response.status).toBe(401);
  });

  it('reports zero stuck orders without notifying anyone', async () => {
    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      stuckOrders: 0,
      merchants: 0,
      merchantsNotified: 0,
    });
    expect(mocks.notifyMerchant).not.toHaveBeenCalled();
  });

  it('sends one aggregated alert per merchant with stuck orders', async () => {
    mocks.limit.mockResolvedValue({
      data: [
        stuckOrder({ id: 'order-1', order_number: 'ORD-1', total: 100000 }),
        stuckOrder({
          id: 'order-2',
          order_number: 'ORD-2',
          total: 50000,
          notes: null,
        }),
        stuckOrder({
          id: 'order-3',
          order_number: 'ORD-3',
          merchant_id: 'merchant-2',
          total: 25000,
        }),
      ],
      error: null,
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      stuckOrders: 3,
      merchants: 2,
      merchantsNotified: 2,
    });

    expect(mocks.notifyMerchant).toHaveBeenCalledTimes(2);
    expect(mocks.notifyMerchant).toHaveBeenCalledWith(
      'merchant-1',
      '⚠️ BNPL orders need attention',
      expect.stringContaining('2 BNPL orders totalling ₦150,000'),
      expect.objectContaining({
        type: 'stuck_bnpl_alert',
        stuck_order_count: 2,
        total_amount: 150000,
        with_provider_reference: 1,
        oldest_order_id: 'order-1',
      }),
      'orders'
    );
    expect(mocks.notifyMerchant).toHaveBeenCalledWith(
      'merchant-2',
      '⚠️ BNPL orders need attention',
      expect.stringContaining('1 BNPL order totalling ₦25,000'),
      expect.objectContaining({ stuck_order_count: 1 }),
      'orders'
    );
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'BNPL orders stuck awaiting provider confirmation',
        merchantId: 'merchant-1',
        stuckOrderCount: 2,
        withProviderReference: 1,
      })
    );
  });

  it('scans every stuck BNPL status and ages on row movement, not creation', async () => {
    await GET(createCronRequest());

    expect(mocks.statusIn).toHaveBeenCalledWith('payment_status', [
      'bnpl_pending',
      'bnpl_approved',
      'pending',
      'unpaid',
    ]);
    expect(mocks.statusIn).toHaveBeenCalledWith('payment_method', [
      'credit_direct',
      'klump',
      'credpal',
    ]);
    expect(mocks.lt).toHaveBeenCalledWith('updated_at', expect.any(String));
    expect(mocks.gte).toHaveBeenCalledWith('updated_at', expect.any(String));
  });

  it('warns that the report may be partial when the scan hits its limit', async () => {
    mocks.limit.mockResolvedValue({
      data: Array.from({ length: 500 }, (_, index) =>
        stuckOrder({ id: `order-${index}`, order_number: `ORD-${index}` })
      ),
      error: null,
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stuckOrders).toBe(500);
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Stuck-BNPL scan hit scan limit; report may be partial',
        scanLimit: 500,
      })
    );
  });

  it('accepts a transactions row as provider evidence for pending orders without notes', async () => {
    mocks.limit.mockResolvedValue({
      data: [
        stuckOrder({
          id: 'order-1',
          payment_status: 'unpaid',
          payment_method: 'credpal',
          notes: null,
        }),
      ],
      error: null,
    });
    mocks.transactionsIn.mockResolvedValue({
      data: [{ order_id: 'order-1' }],
      error: null,
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stuckOrders).toBe(1);
    expect(mocks.transactionsIn).toHaveBeenCalledWith('order_id', ['order-1']);
    expect(mocks.notifyMerchant).toHaveBeenCalledTimes(1);
  });

  it('skips pending orders conservatively when the transaction-evidence check fails', async () => {
    mocks.limit.mockResolvedValue({
      data: [
        stuckOrder({
          id: 'order-1',
          payment_status: 'unpaid',
          payment_method: 'credpal',
          notes: null,
        }),
      ],
      error: null,
    });
    mocks.transactionsIn.mockResolvedValue({
      data: null,
      error: { message: 'transactions unavailable' },
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stuckOrders).toBe(0);
    expect(mocks.notifyMerchant).not.toHaveBeenCalled();
    expect(mocks.loggerWarn).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          'Stuck-BNPL scan could not check transaction evidence; pending/unpaid orders without notes evidence are skipped this run',
      })
    );
  });

  it('requires provider-session evidence for pending/unpaid orders', async () => {
    mocks.limit.mockResolvedValue({
      data: [
        stuckOrder({
          id: 'order-1',
          payment_status: 'unpaid',
          payment_method: 'credpal',
          notes: null,
        }),
        stuckOrder({
          id: 'order-2',
          payment_status: 'unpaid',
          payment_method: 'credpal',
          notes: '{"credpalTransactionId":"cp-1"}',
        }),
        stuckOrder({
          id: 'order-3',
          payment_status: 'bnpl_pending',
          notes: null,
        }),
      ],
      error: null,
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.stuckOrders).toBe(2);
    expect(mocks.notifyMerchant).toHaveBeenCalledWith(
      'merchant-1',
      expect.any(String),
      expect.stringContaining('2 BNPL orders'),
      expect.objectContaining({ stuck_order_count: 2 }),
      'orders'
    );
  });

  it('reports merchants whose push delivery failed', async () => {
    mocks.limit.mockResolvedValue({
      data: [stuckOrder()],
      error: null,
    });
    mocks.notifyMerchant.mockResolvedValue({
      sent: 0,
      failed: 1,
      errors: ['no active tokens'],
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      stuckOrders: 1,
      merchants: 1,
      merchantsNotified: 0,
      pushFailures: ['merchant-1'],
    });
  });

  it('still succeeds when the push helper throws', async () => {
    mocks.limit.mockResolvedValue({
      data: [stuckOrder()],
      error: null,
    });
    mocks.notifyMerchant.mockRejectedValue(new Error('expo outage'));

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.pushFailures).toEqual(['merchant-1']);
    expect(mocks.loggerError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'Failed to push stuck-BNPL alert' })
    );
  });

  it('returns 500 when the order scan fails', async () => {
    mocks.limit.mockResolvedValue({
      data: null,
      error: { message: 'db down' },
    });

    const response = await GET(createCronRequest());
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to scan orders' });
    expect(mocks.notifyMerchant).not.toHaveBeenCalled();
  });
});
