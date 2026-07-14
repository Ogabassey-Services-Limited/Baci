import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCronSecret } from '@/env';
import * as paypalSweep from '@/lib/payments/paypal-reconciliation-sweep';
import { sweepStrandedPaypalCaptures } from '@/lib/payments/paypal-reconciliation-sweep';
import { GET } from './route';

vi.mock('server-only', () => ({}));

vi.mock('@/env', () => ({ getCronSecret: vi.fn() }));

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('@/lib/supabase/admin', () => ({
  createClient: vi.fn(() => ({}) as never),
}));

vi.mock('@/lib/payments/paypal-reconciliation-sweep', () => ({
  sweepStrandedPaypalCaptures: vi.fn(),
  sweepPendingPaypalRefunds: vi.fn(),
}));

const SECRET = 'cron-secret';

function request(authorization?: string) {
  return new NextRequest('https://baci.test/api/cron/paypal-reconciliation', {
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getCronSecret).mockReturnValue(SECRET);
  vi.mocked(sweepStrandedPaypalCaptures).mockResolvedValue({
    scanned: 3,
    settled: 1,
    notCaptured: 2,
    failed: 0,
    truncated: false,
  });
  (
    paypalSweep as unknown as {
      sweepPendingPaypalRefunds: ReturnType<typeof vi.fn>;
    }
  ).sweepPendingPaypalRefunds.mockResolvedValue({
    scanned: 1,
    completed: 1,
    stillPending: 0,
    failed: 0,
    truncated: false,
  });
});

describe('GET /api/cron/paypal-reconciliation', () => {
  it('runs the sweep and reports what it recovered', async () => {
    const response = await GET(request(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ ok: true, scanned: 3, settled: 1 });
    expect(body.refunds).toMatchObject({ scanned: 1, completed: 1 });
    expect(
      (
        paypalSweep as unknown as {
          sweepPendingPaypalRefunds: ReturnType<typeof vi.fn>;
        }
      ).sweepPendingPaypalRefunds
    ).toHaveBeenCalledTimes(1);
  });

  it('returns 401 without the cron secret — this endpoint settles real money', async () => {
    const response = await GET(request());

    expect(response.status).toBe(401);
    expect(sweepStrandedPaypalCaptures).not.toHaveBeenCalled();
  });

  it('rejects a wrong secret', async () => {
    const response = await GET(request('Bearer nope'));

    expect(response.status).toBe(401);
    expect(sweepStrandedPaypalCaptures).not.toHaveBeenCalled();
  });

  it('fails CLOSED when CRON_SECRET is not configured', async () => {
    // An unauthenticated money-settling endpoint is worse than no sweeper at all.
    vi.mocked(getCronSecret).mockReturnValue(undefined as never);

    const response = await GET(request(`Bearer ${SECRET}`));

    expect(response.status).toBe(500);
    expect(sweepStrandedPaypalCaptures).not.toHaveBeenCalled();
  });

  it('reports 500 when the sweep itself fails — a broken safety net must be loud', async () => {
    vi.mocked(sweepStrandedPaypalCaptures).mockRejectedValue(
      new Error('db down')
    );

    const response = await GET(request(`Bearer ${SECRET}`));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.ok).toBe(false);
  });
});
