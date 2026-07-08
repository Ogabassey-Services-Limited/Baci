import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const mocks = vi.hoisted(() => ({
  ensureActionRateLimit: vi.fn(),
  getCachedMerchant: vi.fn(),
  getCachedMerchantByDomain: vi.fn(),
  lookupRepairStatus: vi.fn(),
  createAnonClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/ensure-action-rate-limit', () => ({
  ensureActionRateLimit: mocks.ensureActionRateLimit,
}));

vi.mock('@/lib/cached-data', () => ({
  getCachedMerchant: mocks.getCachedMerchant,
  getCachedMerchantByDomain: mocks.getCachedMerchantByDomain,
}));

vi.mock('@/lib/repairs/status-lookup', () => ({
  lookupRepairStatus: mocks.lookupRepairStatus,
}));

vi.mock('@/lib/supabase/anon', () => ({
  createAnonClient: mocks.createAnonClient,
}));

function buildRequest(body: unknown): Request {
  return new Request(
    'https://store.example.com/api/storefront/acme/repair/status',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }
  );
}

const params = Promise.resolve({ slug: 'acme' });

describe('POST /api/storefront/[slug]/repair/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.ensureActionRateLimit.mockResolvedValue(true);
    mocks.getCachedMerchant.mockResolvedValue({ id: 'm-1' });
  });

  it('returns 429 when rate limited', async () => {
    mocks.ensureActionRateLimit.mockResolvedValueOnce(false);

    const res = await POST(
      buildRequest({ ticketNumber: 1, email: 'a@b.com' }) as never,
      {
        params,
      }
    );

    expect(res.status).toBe(429);
    expect(mocks.lookupRepairStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when the store does not exist', async () => {
    mocks.getCachedMerchant.mockResolvedValueOnce(null);

    const res = await POST(
      buildRequest({ ticketNumber: 1, email: 'a@b.com' }) as never,
      {
        params,
      }
    );

    expect(res.status).toBe(404);
    expect(mocks.lookupRepairStatus).not.toHaveBeenCalled();
  });

  it('returns 400 when the body is invalid', async () => {
    const res = await POST(buildRequest({ email: 'nope' }) as never, {
      params,
    });

    expect(res.status).toBe(400);
    expect(mocks.lookupRepairStatus).not.toHaveBeenCalled();
  });

  it('returns a generic found:false for a mismatch (no enumeration)', async () => {
    mocks.lookupRepairStatus.mockResolvedValueOnce({ found: false });

    const res = await POST(
      buildRequest({ ticketNumber: 1042, email: 'ada@example.com' }) as never,
      { params }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ found: false });
  });

  it('returns the repair status on a match', async () => {
    const result = {
      ticketNumber: 1042,
      status: 'in_progress',
      deviceLabel: 'Smartphone iPhone 15',
      repairTypeLabel: 'Screen Replacement',
      serviceType: 'pickup',
      createdAt: '2026-07-01T00:00:00.000Z',
      updatedAt: '2026-07-05T00:00:00.000Z',
      trackingNumber: 'TRK-1',
    };
    mocks.lookupRepairStatus.mockResolvedValueOnce({ found: true, result });

    const res = await POST(
      buildRequest({
        ticketNumber: '#1042',
        email: 'ADA@example.com',
      }) as never,
      { params }
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ found: true, repair: result });
    expect(mocks.lookupRepairStatus).toHaveBeenCalledWith(
      {},
      'm-1',
      1042,
      'ada@example.com'
    );
  });
});
