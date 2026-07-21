import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createServiceClient: vi.fn(),
  drainFailedOrderCancellationSideEffects: vi.fn(),
  drainFailedPaidOrderSideEffects: vi.fn(),
  getCronSecret: vi.fn(),
  reconcileWedgedGatewayOrders: vi.fn(),
}));

vi.mock('@/env', () => ({
  getCronSecret: mocks.getCronSecret,
}));
vi.mock('@/lib/supabase/service', () => ({
  createServiceClient: mocks.createServiceClient,
}));
vi.mock('@/lib/payments/reconcile-wedged-gateway-orders', () => ({
  reconcileWedgedGatewayOrders: mocks.reconcileWedgedGatewayOrders,
}));
vi.mock('@/lib/payments/drain-failed-paid-order-side-effects', () => ({
  drainFailedPaidOrderSideEffects: mocks.drainFailedPaidOrderSideEffects,
}));
vi.mock('@/lib/orders/drain-failed-order-cancellation-side-effects', () => ({
  drainFailedOrderCancellationSideEffects:
    mocks.drainFailedOrderCancellationSideEffects,
}));

import { GET } from './route';

const CRON_SECRET = 'cron-secret-for-tests';

function buildRequest(authorization?: string) {
  return new NextRequest(
    'https://usebaci.com/api/cron/reconcile-gateway-paid-orders',
    {
      headers: authorization ? { authorization } : undefined,
    }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getCronSecret.mockReturnValue(CRON_SECRET);
  mocks.createServiceClient.mockReturnValue({});
  mocks.drainFailedPaidOrderSideEffects.mockResolvedValue({
    drained: [],
    failed: [],
    skipped: [],
  });
  mocks.drainFailedOrderCancellationSideEffects.mockResolvedValue({
    drained: [],
    failed: [],
    skipped: [],
  });
});

describe('GET /api/cron/reconcile-gateway-paid-orders', () => {
  it('returns 500 server_misconfigured when CRON_SECRET is unset', async () => {
    mocks.getCronSecret.mockReturnValue(undefined);

    const response = await GET(buildRequest(`Bearer ${CRON_SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'server_misconfigured' });
    expect(mocks.reconcileWedgedGatewayOrders).not.toHaveBeenCalled();
  });

  it('returns 401 when the bearer token is missing or wrong', async () => {
    const missing = await GET(buildRequest());
    const wrong = await GET(buildRequest('Bearer nope'));

    expect(missing.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(mocks.reconcileWedgedGatewayOrders).not.toHaveBeenCalled();
  });

  it('runs the sweep and returns its summary on success', async () => {
    const summary = {
      checked: 1,
      detectedUnhealable: [],
      failed: [],
      healed: [{ orderId: 'order-1', orderNumber: 'ORD-1' }],
      skipped: [],
    };
    mocks.reconcileWedgedGatewayOrders.mockResolvedValue(summary);

    const response = await GET(buildRequest(`Bearer ${CRON_SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject(summary);
    expect(body.sideEffectDrain).toEqual({
      drained: [],
      failed: [],
      skipped: [],
    });
    expect(body.cancellationSideEffectDrain).toEqual({
      drained: [],
      failed: [],
      skipped: [],
    });
    expect(typeof body.checked_at).toBe('string');
    expect(mocks.reconcileWedgedGatewayOrders).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: expect.anything() })
    );
    expect(mocks.drainFailedPaidOrderSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: expect.anything() })
    );
    expect(mocks.drainFailedOrderCancellationSideEffects).toHaveBeenCalledWith(
      expect.objectContaining({ supabase: expect.anything() })
    );
  });

  it('returns 500 when the sweep itself throws', async () => {
    mocks.reconcileWedgedGatewayOrders.mockRejectedValue(
      new Error('lookup exploded')
    );

    const response = await GET(buildRequest(`Bearer ${CRON_SECRET}`));

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Cron job failed' });
  });
});
