import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockRevalidateMerchantFeed = vi.fn();

vi.mock('@/lib/cache-revalidation', () => ({
  revalidateMerchantFeed: (...args: unknown[]) =>
    mockRevalidateMerchantFeed(...args),
}));

import { POST } from './route';

function makeRequest(body: unknown, authHeader?: string): NextRequest {
  const req = new NextRequest(
    'http://localhost/api/feed/google-merchant/revalidate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(body),
    }
  );
  return req;
}

describe('POST /api/feed/google-merchant/revalidate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv('CRON_SECRET', 'test-secret');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 401 when CRON_SECRET is unset (fail-closed)', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer undefined')
    );
    expect(res.status).toBe(401);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header is missing', async () => {
    const res = await POST(makeRequest({ identifier: 'ogabassey' }));
    expect(res.status).toBe(401);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 401 when authorization header has wrong secret', async () => {
    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer wrong-secret')
    );
    expect(res.status).toBe(401);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 400 when identifier is missing', async () => {
    const res = await POST(makeRequest({}, 'Bearer test-secret'));
    expect(res.status).toBe(400);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 400 when identifier is not a string', async () => {
    const res = await POST(
      makeRequest({ identifier: 123 }, 'Bearer test-secret')
    );
    expect(res.status).toBe(400);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('calls revalidateMerchantFeed and returns 200 on valid request', async () => {
    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer test-secret')
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ revalidated: true, identifier: 'ogabassey' });
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledWith('ogabassey');
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledTimes(1);
  });

  it('returns 400 when request body is malformed JSON', async () => {
    const req = new NextRequest(
      'http://localhost/api/feed/google-merchant/revalidate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-secret',
        },
        body: 'not valid json',
      }
    );
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(mockRevalidateMerchantFeed).not.toHaveBeenCalled();
  });

  it('returns 500 when revalidation throws', async () => {
    mockRevalidateMerchantFeed.mockImplementationOnce(() => {
      throw new Error('cache busted poorly');
    });

    const res = await POST(
      makeRequest({ identifier: 'ogabassey' }, 'Bearer test-secret')
    );

    expect(res.status).toBe(500);
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledWith('ogabassey');
    expect(mockRevalidateMerchantFeed).toHaveBeenCalledTimes(1);
  });
});
