import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const canonicalPost = vi.hoisted(() =>
  vi.fn(async () => Response.json({ success: true }, { status: 202 }))
);

vi.mock('@/app/api/analytics/conversion/route', () => ({
  POST: canonicalPost,
}));

import { POST } from './route';

function createLegacyConversionRequest(): NextRequest {
  return new Request('https://usebaci.com/analytics/conversion', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ event_name: 'PURCHASE' }),
  }) as NextRequest;
}

describe('POST /analytics/conversion', () => {
  beforeEach(() => {
    canonicalPost.mockClear();
  });

  it('delegates legacy-path mobile conversion requests to the canonical endpoint', async () => {
    const request = createLegacyConversionRequest();

    const response = await POST(request);

    expect(canonicalPost).toHaveBeenCalledWith(request);
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ success: true });
  });

  it('forwards canonical error responses for legacy-path requests', async () => {
    canonicalPost.mockResolvedValueOnce(
      Response.json({ error: 'invalid payload' }, { status: 400 })
    );
    const request = createLegacyConversionRequest();

    const response = await POST(request);

    expect(canonicalPost).toHaveBeenCalledWith(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'invalid payload',
    });
  });

  it('propagates canonical endpoint exceptions for legacy-path requests', async () => {
    const error = new Error('canonical failure');
    canonicalPost.mockRejectedValueOnce(error);

    await expect(POST(createLegacyConversionRequest())).rejects.toThrow(error);
  });
});
