import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  checkCsrfProtection: vi.fn(),
  createClient: vi.fn(),
  getMerchantForApiRequest: vi.fn(),
  hasPermission: vi.fn(),
  toUserAccess: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({})),
}));
vi.mock('@/lib/api-auth', () => ({
  hasPermission: mocks.hasPermission,
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/get-merchant-for-api-request', () => ({
  getMerchantForApiRequest: mocks.getMerchantForApiRequest,
  toUserAccess: mocks.toUserAccess,
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: mocks.createClient,
}));

import { GET, POST } from './route';

function createQuery(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(() => query),
    select: vi.fn(() => query),
    single: vi.fn(() => Promise.resolve(result)),
    upsert: vi.fn(() => query),
  };
  return query;
}

describe('dashboard preferences merchant context', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getMerchantForApiRequest.mockResolvedValue({
      merchantId: 'merchant-1',
    });
    mocks.hasPermission.mockReturnValue(true);
    mocks.toUserAccess.mockReturnValue({ permissions: {} });
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: true,
      response: null,
    });
  });

  it('reads preferences for the selected merchant', async () => {
    const query = createQuery({
      data: { layout_config: [], visible_cards: [] },
      error: null,
    });
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn(() => query),
    });

    const requestedMerchantId = '123e4567-e89b-42d3-a456-426614174000';
    const response = await GET(
      new Request('https://usebaci.com/api/dashboard/preferences', {
        headers: { 'x-baci-merchant-id': requestedMerchantId },
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId }
    );
  });

  it('writes preferences for the selected merchant', async () => {
    const query = createQuery({
      data: { layout_config: [], visible_cards: [] },
      error: null,
    });
    mocks.createClient.mockReturnValue({
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      },
      from: vi.fn(() => query),
    });

    const requestedMerchantId = '123e4567-e89b-42d3-a456-426614174000';
    const response = await POST(
      new NextRequest('https://usebaci.com/api/dashboard/preferences', {
        body: JSON.stringify({ layout_config: [] }),
        headers: {
          'Content-Type': 'application/json',
          'x-baci-merchant-id': requestedMerchantId,
        },
        method: 'POST',
      })
    );

    expect(response.status).toBe(200);
    expect(mocks.getMerchantForApiRequest).toHaveBeenCalledWith(
      expect.anything(),
      'user-1',
      { requestedMerchantId }
    );
  });

  it('authenticates before rejecting an invalid CSRF token', async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null } });
    mocks.createClient.mockReturnValue({ auth: { getUser } });
    mocks.checkCsrfProtection.mockResolvedValue({
      valid: false,
      response: null,
    });

    const response = await POST(
      new NextRequest('https://usebaci.com/api/dashboard/preferences', {
        body: JSON.stringify({ layout_config: [] }),
        method: 'POST',
      })
    );

    expect(response.status).toBe(401);
    expect(getUser).toHaveBeenCalledOnce();
    expect(mocks.checkCsrfProtection).not.toHaveBeenCalled();
  });
});
