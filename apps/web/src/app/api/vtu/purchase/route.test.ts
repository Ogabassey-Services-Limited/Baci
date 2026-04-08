import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAuthenticateApiRequest = vi.fn();
const mockPreparePendingVtuTransaction = vi.fn();
const mockFulfillPendingVtuTransaction = vi.fn();

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
}));

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(() =>
    Promise.resolve({ valid: true, response: null })
  ),
}));

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({})),
}));

vi.mock('@/lib/vtu-pending-transaction', () => ({
  preparePendingVtuTransaction: (...args: unknown[]) =>
    mockPreparePendingVtuTransaction(...args),
  VTU_TYPE_LABELS: {
    airtime: 'Airtime',
    data: 'Data',
    electricity: 'Electricity',
    cable_tv: 'TV Subscription',
    betting: 'Betting Top-up',
  },
}));

vi.mock('@/lib/vtu-fulfillment', () => ({
  fulfillPendingVtuTransaction: (...args: unknown[]) =>
    mockFulfillPendingVtuTransaction(...args),
}));

import { POST } from './route';

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/vtu/purchase', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/vtu/purchase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticateApiRequest.mockResolvedValue({
      user: { id: 'user-1', email: 'customer@example.com' },
      error: null,
      supabase: {},
    });
    mockPreparePendingVtuTransaction.mockResolvedValue({
      transaction: { id: 'vtu-1' },
    });
    mockFulfillPendingVtuTransaction.mockResolvedValue({
      status: 'successful',
      amount: 1000,
      reference: 'VTU-123',
      cashback: {
        amount: 50,
        credited: true,
        newBalance: 150,
      },
    });
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Not authenticated',
      supabase: null,
    });

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        source: 'checkout',
      })
    );

    expect(response.status).toBe(401);
  });

  it('returns 409 for blocked direct requests', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        source: 'direct',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(409);
    expect(data.error).toMatch(/disabled/i);
  });

  it('maps validation failures to 400', async () => {
    const response = await POST(makeRequest({ amount: 10 }));
    expect(response.status).toBe(400);
  });

  it('returns 403 when preparation reports a disabled merchant feature', async () => {
    mockPreparePendingVtuTransaction.mockRejectedValue(
      new Error('VTU is not enabled for this merchant')
    );

    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        source: 'checkout',
      })
    );

    expect(response.status).toBe(403);
  });

  it('returns the shared fulfillment payload on success', async () => {
    const response = await POST(
      makeRequest({
        merchantSlug: 'ogabassey',
        amount: 1000,
        type: 'airtime',
        phoneNumber: '08012345678',
        networkProvider: 'MTN',
        source: 'checkout',
      })
    );
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      success: true,
      reference: 'VTU-123',
      amount: 1000,
      cashback: {
        amount: 50,
        credited: true,
        newBalance: 150,
      },
    });
  });
});
