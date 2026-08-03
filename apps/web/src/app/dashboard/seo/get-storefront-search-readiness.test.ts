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

describe('getStorefrontSearchReadiness', () => {
  beforeEach(() => {
    Object.assign(mockSupabase, { auth: { getUser: mockGetUser } });
    mockGetUser.mockReset();
    vi.mocked(ensurePermission).mockReset();
  });

  it('rejects a caller-supplied merchant id that differs from the authorized merchant', async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    vi.mocked(ensurePermission).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);

    await expect(getStorefrontSearchReadiness('merchant-2')).rejects.toThrow(
      'Merchant mismatch'
    );
  });

  it('counts missing catalog media through images rather than a nonexistent image column', async () => {
    const calls: Array<{ table: string; columns: string; operation?: string }> =
      [];
    const createTerminal = (table: string, columns: string) => {
      const result =
        table === 'merchants'
          ? {
              data: {
                business_name: 'Zorvexa',
                is_published: true,
                slug: 'zorvexa',
                custom_domain: null,
                site_description: 'Store description',
                site_tagline: null,
                support_email: 'support@zorvexa.example',
                support_phone: null,
                trust_profile: {},
              },
              error: null,
            }
          : { count: 0, error: null };
      const terminal = Object.assign(Promise.resolve(result), {
        eq: () => terminal,
        is: (column: string) => {
          calls.push({ table, columns, operation: `is:${column}` });
          return terminal;
        },
        or: (filter: string) => {
          calls.push({ table, columns, operation: `or:${filter}` });
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

    await getStorefrontSearchReadiness('merchant-1');

    expect(calls).toContainEqual(
      expect.objectContaining({
        table: 'products',
        operation: 'or:images.is.null,images.eq.[]',
      })
    );
    expect(calls).not.toContainEqual(
      expect.objectContaining({ table: 'products', operation: 'or:image.' })
    );
  });

  it('uses the authorized custom domain without projecting it from merchants', async () => {
    const selections: string[] = [];
    const terminalFor = (table: string, columns: string) => {
      const result =
        table === 'merchants' && columns.includes('custom_domain')
          ? {
              data: null,
              error: {
                message: 'column merchants.custom_domain does not exist',
              },
            }
          : table === 'merchants'
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
            : { count: 0, error: null };
      const terminal = Object.assign(Promise.resolve(result), {
        eq: () => terminal,
        or: () => terminal,
        maybeSingle: () => terminal,
      });
      return terminal;
    };
    Object.assign(mockSupabase, {
      auth: { getUser: mockGetUser },
      from: (table: string) => ({
        select: (columns: string) => {
          selections.push(columns);
          return terminalFor(table, columns);
        },
      }),
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    vi.mocked(ensurePermission).mockResolvedValue({
      merchant: { id: 'merchant-1', custom_domain: 'shop.zorvexa.example' },
    } as never);

    await expect(getStorefrontSearchReadiness('merchant-1')).resolves.toEqual(
      expect.any(Object)
    );

    expect(
      selections.some((columns) => columns.includes('custom_domain'))
    ).toBe(false);
  });

  it('surfaces a bounded database count failure instead of presenting it as ready', async () => {
    const terminalFor = (table: string) => {
      const result =
        table === 'merchants'
          ? {
              data: {
                business_name: 'Zorvexa',
                is_published: true,
                slug: 'zorvexa',
                custom_domain: null,
                site_description: 'Store description',
                site_tagline: null,
                support_email: 'support@zorvexa.example',
                support_phone: null,
                trust_profile: {},
              },
              error: null,
            }
          : { count: null, error: { message: 'catalog unavailable' } };
      const terminal = Object.assign(Promise.resolve(result), {
        eq: () => terminal,
        or: () => terminal,
        maybeSingle: () => terminal,
      });
      return terminal;
    };
    Object.assign(mockSupabase, {
      auth: { getUser: mockGetUser },
      from: (table: string) => ({ select: () => terminalFor(table) }),
    });
    mockGetUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    vi.mocked(ensurePermission).mockResolvedValue({
      merchant: { id: 'merchant-1' },
    } as never);

    await expect(getStorefrontSearchReadiness('merchant-1')).rejects.toThrow(
      'catalog unavailable'
    );
  });

  it('does not invent a canonical URL when bounded merchant identity lacks a slug', async () => {
    const terminalFor = (table: string) => {
      const result =
        table === 'merchants'
          ? {
              data: {
                business_name: 'Zorvexa',
                is_published: true,
                slug: null,
                custom_domain: null,
                site_description: 'Store description',
                site_tagline: null,
                support_email: 'support@zorvexa.example',
                support_phone: null,
                trust_profile: {},
              },
              error: null,
            }
          : { count: 0, error: null };
      const terminal = Object.assign(Promise.resolve(result), {
        eq: () => terminal,
        or: () => terminal,
        maybeSingle: () => terminal,
      });
      return terminal;
    };
    Object.assign(mockSupabase, {
      auth: { getUser: mockGetUser },
      from: (table: string) => ({ select: () => terminalFor(table) }),
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
      tier: 'blocked',
      blockers: [{ code: 'home_not_indexable' }],
    });
  });
});
