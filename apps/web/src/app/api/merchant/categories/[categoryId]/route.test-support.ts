import { NextRequest, NextResponse } from 'next/server';
import { vi } from 'vitest';

export const CATEGORY_ID = '22222222-2222-4222-8222-222222222222';
export const MERCHANT_UUID = '33333333-3333-4333-8333-333333333333';
const MERCHANT_ID = 'merchant-1';

interface RouteMocks {
  authenticateCategoryRequest: ReturnType<typeof vi.fn>;
  resolveCategoryRouteContext: ReturnType<typeof vi.fn>;
  getCategoryChildSlugs: ReturnType<typeof vi.fn>;
  validateCategoryParent: ReturnType<typeof vi.fn>;
  checkCsrfProtection: ReturnType<typeof vi.fn>;
  invalidateCategoryCaches: ReturnType<typeof vi.fn>;
}

export interface TableState {
  existing?: {
    id: string;
    slug: string;
    is_active?: boolean | null;
    updated_at?: string | null;
  } | null;
  existingError?: { message: string } | null;
  updated?: Record<string, unknown> | null;
  updateError?: { code?: string; message: string } | null;
  deleted?: { id: string; slug: string } | null;
  deleteError?: { message: string } | null;
}

export function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

export function createCategoryRouteTestHarness(mocks: RouteMocks) {
  let updatedRow: Record<string, unknown> | null = null;

  function supabaseFor(state: TableState) {
    const existing =
      state.existing === undefined
        ? {
            id: CATEGORY_ID,
            slug: 'phones',
            is_active: true,
            updated_at: '2026-07-26T10:00:00.000Z',
          }
        : state.existing;

    return {
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: state.existingError ? null : existing,
                error: state.existingError ?? null,
              }),
            })),
          })),
        })),
        update: vi.fn((row: Record<string, unknown>) => {
          updatedRow = row;
          const deleteResult = {
            data:
              state.deleted === undefined
                ? { id: CATEGORY_ID, slug: 'phones' }
                : state.deleted,
            error: state.deleteError ?? null,
          };
          return {
            eq: vi.fn(() => ({
              eq: vi.fn(() => {
                const select = vi.fn((columns: string) => {
                  if (columns === 'id, slug') {
                    return {
                      maybeSingle: vi.fn().mockResolvedValue(deleteResult),
                    };
                  }
                  return {
                    maybeSingle: vi.fn().mockResolvedValue({
                      data:
                        state.updated === undefined
                          ? state.updateError
                            ? null
                            : {
                                id: CATEGORY_ID,
                                name: 'Phones',
                                slug: 'mobile-phones',
                                is_active: true,
                              }
                          : state.updated,
                      error: state.updateError ?? null,
                    }),
                  };
                });
                return {
                  select,
                  eq: vi.fn(() => ({
                    select,
                    eq: vi.fn(() => ({ select })),
                    is: vi.fn(() => ({ select })),
                  })),
                };
              }),
            })),
          };
        }),
      })),
    };
  }

  function setContext(state: TableState = {}) {
    const supabase = supabaseFor(state);
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

  function reset() {
    vi.clearAllMocks();
    updatedRow = null;
    setContext();
    mocks.checkCsrfProtection.mockResolvedValue({ valid: true });
    mocks.validateCategoryParent.mockResolvedValue(null);
    mocks.getCategoryChildSlugs.mockResolvedValue({ ok: true, slugs: [] });
    mocks.invalidateCategoryCaches.mockResolvedValue({
      revalidatedSlugs: ['phones', 'mobile-phones'],
      revalidated: true,
      vercelEvicted: true,
    });
  }

  return {
    deleteRequest(merchantId?: string) {
      const query = merchantId ? `?merchantId=${merchantId}` : '';
      return new NextRequest(
        `https://baci.app/api/merchant/categories/${CATEGORY_ID}${query}`,
        { method: 'DELETE' }
      );
    },
    getUpdatedRow: () => updatedRow,
    params: (categoryId = CATEGORY_ID) => ({
      params: Promise.resolve({ categoryId }),
    }),
    patchRequest(body: unknown) {
      return new NextRequest(
        `https://baci.app/api/merchant/categories/${CATEGORY_ID}`,
        {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        }
      );
    },
    reset,
    setContext,
    setUnauthenticated() {
      mocks.authenticateCategoryRequest.mockResolvedValue({
        ok: false,
        response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
      });
    },
  };
}
