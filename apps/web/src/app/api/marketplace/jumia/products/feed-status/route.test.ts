import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  csrf: vi.fn(),
  auth: vi.fn(),
  merchant: vi.fn(),
  access: vi.fn(),
  permission: vi.fn(),
  gate: vi.fn(),
  client: vi.fn(),
  feed: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/csrf', () => ({ checkCsrfProtection: mocks.csrf }));
vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: mocks.auth,
  getMerchantIdForApiUser: mocks.merchant,
  getUserAccess: mocks.access,
  hasPermission: mocks.permission,
}));
vi.mock('@/lib/merchant-feature-gates', () => ({
  requireMerchantFeatureAccess: mocks.gate,
}));
vi.mock('@/lib/jumia/client', () => ({
  JumiaClient: { forIntegration: mocks.client },
  JumiaApiError: class JumiaApiError extends Error {},
  jumiaErrorResponse: vi.fn(() =>
    Response.json({ error: 'Jumia error' }, { status: 502 })
  ),
}));
vi.mock('@/lib/jumia/feeds', () => ({ getFeedStatus: mocks.feed }));
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }));

import { POST } from './route';

function request() {
  return new NextRequest(
    'http://localhost/api/marketplace/jumia/products/feed-status?integrationId=00000000-0000-4000-8000-000000000099',
    { method: 'POST' }
  );
}

function mappingSelect(data: unknown, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              not: vi.fn().mockResolvedValue({ data, error }),
            }),
          }),
        }),
      }),
    }),
  };
}

function mappingUpdate(update: (...args: unknown[]) => void) {
  return (...args: unknown[]) => {
    update(...args);
    const resolved = Promise.resolve({ error: null });
    const builder = Object.assign(resolved, {
      eq: vi.fn(),
    });
    builder.eq.mockReturnValue(builder);
    return builder;
  };
}

describe('Jumia feed status route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.csrf.mockResolvedValue({ valid: true });
    mocks.auth.mockResolvedValue({
      user: { id: 'user-1' },
      error: null,
      supabase: { from: mocks.from },
    });
    mocks.merchant.mockResolvedValue('merchant-1');
    mocks.access.mockResolvedValue({
      merchantId: 'merchant-1',
      role: 'owner',
      isOwner: true,
      isStaff: false,
      permissions: {},
    });
    mocks.permission.mockReturnValue(true);
    mocks.gate.mockResolvedValue(null);
    mocks.client.mockResolvedValue({
      shopId: 'shop-1',
      marketplaceKey: 'default',
    });
  });

  it('rejects malformed integration ids before loading the client', async () => {
    const response = await POST(
      new NextRequest(
        'http://localhost/api/marketplace/jumia/products/feed-status?integrationId=bad',
        { method: 'POST' }
      )
    );
    expect(response.status).toBe(400);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mocks.auth.mockResolvedValueOnce({
      user: null,
      error: new Error('Unauthorized'),
      supabase: null,
    });

    const response = await POST(request());
    expect(response.status).toBe(401);
    expect(mocks.client).not.toHaveBeenCalled();
  });

  it('returns 500 when pending mapping lookup fails', async () => {
    mocks.from.mockReturnValue(
      mappingSelect(null, { message: 'database unavailable' })
    );

    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.json()).toMatchObject({
      error: 'Failed to load pending product feeds',
    });
    expect(mocks.feed).not.toHaveBeenCalled();
  });

  it('reconciles accepted feed items into synced mappings', async () => {
    const update = vi.fn();
    mocks.from.mockReturnValue({
      ...mappingSelect([
        {
          id: 'mapping-1',
          last_feed_id: 'feed-1',
          jumia_seller_sku: 'SKU-1',
        },
      ]),
      update: mappingUpdate(update),
    });
    mocks.feed.mockResolvedValue({
      feedSid: 'feed-1',
      status: 'COMPLETED',
      feedType: 'ProductCreate',
      feedSource: 'API',
      total: 1,
      completed: 1,
      failed: 0,
      createdBy: { sid: 'sid', name: 'API', email: 'api@example.com' },
      feedItems: [
        {
          status: 'SUCCESS',
          productSid: 'JUMIA-1',
          sellerSKU: 'SKU-1',
          createdAt: '2026-08-12T10:00:00Z',
          updatedAt: '2026-08-12T10:00:00Z',
        },
      ],
    });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).updated).toBe(1);
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        sync_status: 'synced',
        jumia_product_id: 'JUMIA-1',
      })
    );
  });

  it('does not reuse a null-SKU fallback when multiple feed items exist', async () => {
    const update = vi.fn();
    mocks.from.mockReturnValue({
      ...mappingSelect([
        {
          id: 'mapping-1',
          last_feed_id: 'feed-1',
          jumia_seller_sku: null,
        },
        {
          id: 'mapping-2',
          last_feed_id: 'feed-1',
          jumia_seller_sku: null,
        },
      ]),
      update: mappingUpdate(update),
    });
    mocks.feed.mockResolvedValue({
      feedSid: 'feed-1',
      status: 'COMPLETED',
      feedType: 'ProductCreate',
      feedSource: 'API',
      total: 2,
      completed: 0,
      failed: 0,
      createdBy: { sid: 'sid', name: 'API', email: 'api@example.com' },
      feedItems: [
        {
          status: 'SUCCESS',
          productSid: 'JUMIA-1',
          sellerSKU: 'SKU-1',
          createdAt: '2026-08-12T10:00:00Z',
          updatedAt: '2026-08-12T10:00:00Z',
        },
        {
          status: 'SUCCESS',
          productSid: 'JUMIA-2',
          sellerSKU: 'SKU-2',
          createdAt: '2026-08-12T10:00:00Z',
          updatedAt: '2026-08-12T10:00:00Z',
        },
      ],
    });

    const response = await POST(request());
    expect(response.status).toBe(200);
    expect((await response.json()).updated).toBe(0);
    expect(update).not.toHaveBeenCalledWith(
      expect.objectContaining({ sync_status: 'synced' })
    );
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({ last_synced_at: expect.any(String) })
    );
  });

  it('returns 500 when the feed reconciliation cursor cannot advance', async () => {
    const update = vi.fn();
    let cursorUpdateCount = 0;
    mocks.from.mockReturnValue({
      ...mappingSelect([
        {
          id: 'mapping-1',
          last_feed_id: 'feed-1',
          jumia_seller_sku: 'SKU-1',
        },
      ]),
      update: (...args: unknown[]) => {
        update(...args);
        cursorUpdateCount += 1;
        const resolved = Promise.resolve({
          error: cursorUpdateCount === 2 ? { message: 'write failed' } : null,
        });
        const builder = Object.assign(resolved, { eq: vi.fn() });
        builder.eq.mockReturnValue(builder);
        return builder;
      },
    });
    mocks.feed.mockResolvedValue({
      feedSid: 'feed-1',
      status: 'COMPLETED',
      feedType: 'ProductCreate',
      feedSource: 'API',
      total: 1,
      completed: 1,
      failed: 0,
      createdBy: { sid: 'sid', name: 'API', email: 'api@example.com' },
      feedItems: [
        {
          status: 'SUCCESS',
          productSid: 'JUMIA-1',
          sellerSKU: 'SKU-1',
          createdAt: '2026-08-12T10:00:00Z',
          updatedAt: '2026-08-12T10:00:00Z',
        },
      ],
    });

    const response = await POST(request());
    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to advance Jumia feed reconciliation cursor',
    });
  });
});
