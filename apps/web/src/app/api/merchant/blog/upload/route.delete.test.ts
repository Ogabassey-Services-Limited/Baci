import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createSupabaseMock,
  DELETE,
  makeDeleteRequest,
  mockAuthenticatedRequest,
  mockAuthorizedMerchant,
  mockCheckCsrfProtection,
  mockCheckRateLimit,
  mockIsManagedBlogStoragePath,
  ownerAccess,
} from './route.test-support';

describe('DELETE /api/merchant/blog/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthorizedMerchant();
    mockIsManagedBlogStoragePath.mockReturnValue(true);
    mockCheckRateLimit.mockResolvedValue(true);
  });

  it('returns 401 before csrf for unauthenticated requests', async () => {
    const { mockAuthenticateApiRequest } = await import('./route.test-support');
    mockAuthenticateApiRequest.mockResolvedValue({
      user: null,
      error: 'Unauthorized',
      supabase: null,
    });
    const response = await DELETE(
      makeDeleteRequest({ path: `${ownerAccess.merchantId}/blog/abc.png` })
    );
    expect(response.status).toBe(401);
    expect(mockCheckCsrfProtection).not.toHaveBeenCalled();
  });

  it('supports backward-compatible delete body with { path }', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const response = await DELETE(
      makeDeleteRequest({ path: `${ownerAccess.merchantId}/blog/abc123.png` })
    );
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(supabase.storage.from).toHaveBeenCalledWith('media');
    expect(remove).toHaveBeenCalledWith([
      `${ownerAccess.merchantId}/blog/abc123.png`,
    ]);
  });

  it('returns 429 and skips storage deletion when rate limited', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockCheckRateLimit.mockResolvedValue(false);
    const response = await DELETE(
      makeDeleteRequest({ path: `${ownerAccess.merchantId}/blog/abc123.png` })
    );
    const body = await response.json();
    expect(response.status).toBe(429);
    expect(body.code).toBe('rate_limited');
    expect(remove).not.toHaveBeenCalled();
  });

  it('deletes deduplicated variant and primary paths in one request', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const primaryPath = `${ownerAccess.merchantId}/blog/abc123.png`;
    const variantPath = `${ownerAccess.merchantId}/blog/abc123/landscape_16x9.webp`;
    const response = await DELETE(
      makeDeleteRequest({
        path: primaryPath,
        variantPaths: {
          landscape_16x9: variantPath,
          standard_4x3: variantPath,
          square_1x1: primaryPath,
        },
      })
    );
    expect(response.status).toBe(200);
    expect(remove.mock.calls[0]?.[0]).toEqual([primaryPath, variantPath]);
  });

  it('rejects delete paths that fail managed-path validation', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    mockIsManagedBlogStoragePath.mockImplementation((path: string) =>
      path.includes('/blog/')
    );
    const response = await DELETE(
      makeDeleteRequest({ path: '../bad/path.png' })
    );
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Access denied' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns 400 for malformed delete JSON payloads', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const response = await DELETE({
      headers: new Headers(),
      json: vi.fn().mockRejectedValue(new Error('malformed json')),
    } as unknown as NextRequest);
    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
    expect(mockCheckRateLimit).not.toHaveBeenCalled();
  });

  it('returns 400 when delete body is missing both path and variantPaths', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const response = await DELETE(makeDeleteRequest({}));
    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });

  it('returns 400 when variantPaths is the wrong type', async () => {
    const { supabase, remove } = createSupabaseMock();
    mockAuthenticatedRequest(supabase);
    const response = await DELETE(
      makeDeleteRequest({
        path: `${ownerAccess.merchantId}/blog/abc123.png`,
        variantPaths: 'invalid',
      })
    );
    expect(response.status).toBe(400);
    expect(remove).not.toHaveBeenCalled();
  });
});
