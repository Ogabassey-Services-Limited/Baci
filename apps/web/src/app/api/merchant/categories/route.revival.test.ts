import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  authenticateCategoryRequest: vi.fn(),
  resolveCategoryRouteContext: vi.fn(),
  validateCategoryParent: vi.fn(),
  checkCsrfProtection: vi.fn(),
  invalidateCategoryCaches: vi.fn(),
}));

vi.mock('./category-route-support', () => ({
  authenticateCategoryRequest: mocks.authenticateCategoryRequest,
  resolveCategoryRouteContext: mocks.resolveCategoryRouteContext,
  firstValidationMessage: (error: { issues: Array<{ message: string }> }) =>
    error.issues[0]?.message ?? 'Invalid input',
}));
vi.mock('./validate-category-parent', () => ({
  validateCategoryParent: mocks.validateCategoryParent,
}));
vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: mocks.checkCsrfProtection,
}));
vi.mock('@/lib/category-cache-invalidation', () => ({
  invalidateCategoryCaches: mocks.invalidateCategoryCaches,
}));

import { POST } from './route';

const MERCHANT_ID = 'merchant-1';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const VALID_BODY = { name: 'Phones', slug: 'phones' };
let revivedRow: Record<string, unknown> | null = null;
let reviveHiddenFilter: unknown[] | null = null;

function supabaseInserting(
  result: {
    error?: { code?: string; message: string };
    revives?: { id: string; name: string; slug: string } | null;
    reviveError?: { message: string } | null;
  } = {}
) {
  return {
    from: vi.fn(() => ({
      insert: vi.fn(() => ({
        select: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: result.error
              ? null
              : {
                  id: 'cat-1',
                  name: 'Phones',
                  slug: 'phones',
                  is_active: true,
                },
            error: result.error ?? null,
          }),
        })),
      })),
      update: vi.fn((row: Record<string, unknown>) => {
        revivedRow = row;
        const reviveResult = {
          select: vi.fn(() => ({
            maybeSingle: vi.fn().mockResolvedValue({
              data: result.reviveError ? null : (result.revives ?? null),
              error: result.reviveError ?? null,
            }),
          })),
        };
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn((...filter: unknown[]) => {
                reviveHiddenFilter = filter;
                return reviveResult;
              }),
            })),
          })),
        };
      }),
    })),
  };
}

function setContext(supabase: unknown) {
  mocks.authenticateCategoryRequest.mockResolvedValue({
    ok: true,
    auth: { userId: 'user-1', supabase },
  });
  mocks.resolveCategoryRouteContext.mockResolvedValue({
    ok: true,
    context: {
      canonicalMerchantSlug: 'merchant-one',
      merchantId: MERCHANT_ID,
      supabase,
    },
  });
}

function postRequest(body: unknown) {
  return new NextRequest('https://baci.app/api/merchant/categories', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST category parent and tombstone behavior', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    revivedRow = null;
    reviveHiddenFilter = null;
    setContext(supabaseInserting());
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.validateCategoryParent.mockResolvedValue(null);
    mocks.invalidateCategoryCaches.mockResolvedValue({
      revalidated: true,
      vercelEvicted: true,
    });
  });

  it('propagates a parent refusal verbatim', async () => {
    mocks.validateCategoryParent.mockResolvedValue(
      NextResponse.json({ code: 'PARENT_RETIRED' }, { status: 400 })
    );

    const response = await POST(
      postRequest({ ...VALID_BODY, parentId: PARENT_ID })
    );

    expect(response.status).toBe(400);
  });

  it('passes no categoryId for a create and skips validation without a parent', async () => {
    await POST(postRequest({ ...VALID_BODY, parentId: PARENT_ID }));
    expect(mocks.validateCategoryParent.mock.calls[0]?.[0]).not.toHaveProperty(
      'categoryId'
    );

    mocks.validateCategoryParent.mockClear();
    await POST(postRequest(VALID_BODY));
    expect(mocks.validateCategoryParent).not.toHaveBeenCalled();
  });

  it('marks tombstone reuse so only reuse clears SEO and memberships', async () => {
    setContext(
      supabaseInserting({
        error: { code: '23505', message: 'duplicate key' },
        revives: { id: 'cat-1', name: 'Phones', slug: 'phones' },
      })
    );

    await POST(postRequest(VALID_BODY));

    expect(revivedRow).toMatchObject({
      metadata: { _baci_reused_tombstone: true },
      seo_description: null,
      seo_faq: null,
      seo_features: null,
      seo_heading: null,
    });
  });

  it('returns 500 when the revive lookup fails', async () => {
    setContext(
      supabaseInserting({
        error: { code: '23505', message: 'duplicate key' },
        reviveError: { message: 'connection reset' },
      })
    );

    expect((await POST(postRequest(VALID_BODY))).status).toBe(500);
  });

  it('keeps live duplicate slugs as 409', async () => {
    setContext(
      supabaseInserting({
        error: { code: '23505', message: 'duplicate key' },
        revives: null,
      })
    );

    expect((await POST(postRequest(VALID_BODY))).status).toBe(409);
  });

  it('keeps legacy null rows live by reviving only explicit tombstones', async () => {
    setContext(
      supabaseInserting({
        error: { code: '23505', message: 'duplicate key' },
        revives: { id: 'cat-1', name: 'Phones', slug: 'phones' },
      })
    );

    expect((await POST(postRequest(VALID_BODY))).status).toBe(201);
    expect(reviveHiddenFilter).toEqual(['is_active', false]);
    expect(revivedRow).toMatchObject({ is_active: true, slug: 'phones' });
  });

  it('returns 500 for any other database error', async () => {
    setContext(
      supabaseInserting({ error: { code: '42501', message: 'denied by RLS' } })
    );

    expect((await POST(postRequest(VALID_BODY))).status).toBe(500);
  });
});
