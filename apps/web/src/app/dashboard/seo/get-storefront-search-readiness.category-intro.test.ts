import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensurePermission } from '@/lib/merchant-server';

const { mockGetUser, mockSupabase } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSupabase: { auth: { getUser: vi.fn() } } as {
    auth: { getUser: unknown };
  },
}));

vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('@/lib/merchant-server', () => ({
  ensurePermission: vi.fn(),
  MerchantAuthenticationRequiredError: class MerchantAuthenticationRequiredError extends Error {},
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}));

const { getStorefrontSearchReadiness } = await import(
  './get-storefront-search-readiness'
);

describe('getStorefrontSearchReadiness category intros', () => {
  beforeEach(() => {
    Object.assign(mockSupabase, { auth: { getUser: mockGetUser } });
    mockGetUser.mockReset();
    vi.mocked(ensurePermission).mockReset();
  });

  it('counts whitespace-only category intros as blank like storefront rendering', async () => {
    const calls: Array<{
      table: string;
      columns?: string;
      operation?: string;
    }> = [];
    const createTerminal = (table: string, _columns: string) => {
      const result =
        table === 'merchants'
          ? {
              data: {
                business_name: 'Zorvexa',
                is_published: true,
                slug: 'zorvexa',
                site_description: 'Store description',
                site_tagline: null,
                support_email: 'support@zorvexa.example',
                support_phone: null,
                trust_profile: {},
              },
              error: null,
            }
          : table === 'products'
            ? { data: [], error: null }
            : table === 'categories'
              ? {
                  data: [
                    { seo_heading: '   ', seo_description: '\n\t' },
                    { seo_heading: 'Useful category', seo_description: '' },
                  ],
                  error: null,
                }
              : { count: 0, error: null };
      const terminal = Object.assign(Promise.resolve(result), {
        eq: () => terminal,
        or: () => terminal,
        order: () => terminal,
        range: (from: number, to: number) => {
          calls.push({ table, operation: `range:${from}-${to}` });
          return terminal;
        },
        maybeSingle: () => terminal,
      });
      return terminal;
    };
    Object.assign(mockSupabase, {
      auth: { getUser: mockGetUser },
      from: (table: string) => ({
        select: (columns: string) => {
          calls.push({ table, columns });
          return createTerminal(table, columns);
        },
      }),
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    vi.mocked(ensurePermission).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);

    await expect(
      getStorefrontSearchReadiness('merchant-1')
    ).resolves.toMatchObject({
      improvements: expect.arrayContaining([
        expect.objectContaining({
          code: 'categories_missing_custom_intro',
          count: 1,
        }),
      ]),
    });

    expect(calls).toContainEqual({
      table: 'categories',
      columns: 'seo_heading, seo_description',
    });
    expect(calls).toContainEqual({
      table: 'categories',
      operation: 'range:0-249',
    });
  });
});
