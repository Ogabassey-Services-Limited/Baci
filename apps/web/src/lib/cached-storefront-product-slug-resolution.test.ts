import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockCreatePublicClient = vi.fn();
const mockRpc = vi.fn();

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/lib/supabase/public', () => ({
  createPublicClient: (...args: unknown[]) => mockCreatePublicClient(...args),
}));

import { getCachedStorefrontProductSlugResolution } from '@/lib/cached-storefront-product-slug-resolution';

describe('getCachedStorefrontProductSlugResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePublicClient.mockReturnValue({ rpc: mockRpc });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns present without a redirect target for an active product slug', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          present: true,
          redirect_product_id: null,
          redirect_product_name: null,
          redirect_product_slug: null,
          redirect_category: null,
          redirect_category_id: null,
          redirect_category_name: null,
          redirect_category_slug: null,
          redirect_category_parent_id: null,
        },
      ],
      error: null,
    });

    const result = await getCachedStorefrontProductSlugResolution(
      'merchant-1',
      'iphone-15'
    );

    expect(result).toEqual({ hasError: false, present: true });
    expect(mockCreatePublicClient).toHaveBeenCalledWith(
      expect.objectContaining({
        clientInfo: 'storefront-product-slug-resolution',
      })
    );
    expect(mockRpc).toHaveBeenCalledWith(
      'get_merchant_product_slug_resolution',
      {
        p_merchant_id: 'merchant-1',
        p_product_slug: 'iphone-15',
      }
    );
  });

  it('normalizes merchant id whitespace and product slug case before the RPC call', async () => {
    mockRpc.mockResolvedValue({
      data: [{ present: true }],
      error: null,
    });

    await getCachedStorefrontProductSlugResolution(
      ' merchant-1 ',
      'iPhone-15-Pro'
    );

    expect(mockRpc).toHaveBeenCalledWith(
      'get_merchant_product_slug_resolution',
      {
        p_merchant_id: 'merchant-1',
        p_product_slug: 'iphone-15-pro',
      }
    );
  });

  it('returns the canonical redirect target for a redirectable archived slug', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          present: true,
          redirect_product_id: 'parent-1',
          redirect_product_name: 'iPhone 15 Pro Max',
          redirect_product_slug: 'iphone-15-pro-max',
          redirect_category: 'Smartphones',
          redirect_category_id: 'category-1',
          redirect_category_name: 'Smartphones',
          redirect_category_slug: 'smartphones',
          redirect_category_parent_id: null,
        },
      ],
      error: null,
    });

    const result = await getCachedStorefrontProductSlugResolution(
      'merchant-1',
      'iphone-15-pro-max-8gb-256gb'
    );

    expect(result).toEqual({
      hasError: false,
      present: true,
      redirectTarget: {
        id: 'parent-1',
        name: 'iPhone 15 Pro Max',
        slug: 'iphone-15-pro-max',
        category: 'Smartphones',
        categories: {
          id: 'category-1',
          name: 'Smartphones',
          slug: 'smartphones',
          parent_id: null,
        },
      },
    });
  });

  it('returns present without a redirect target when redirect data is incomplete', async () => {
    mockRpc.mockResolvedValue({
      data: [
        {
          present: true,
          redirect_product_id: 'parent-1',
          redirect_product_name: null,
          redirect_product_slug: null,
        },
      ],
      error: null,
    });

    const result = await getCachedStorefrontProductSlugResolution(
      'merchant-1',
      'archived-alias'
    );

    expect(result).toEqual({ hasError: false, present: true });
  });

  it('returns present:false when the RPC proves the slug is absent', async () => {
    mockRpc.mockResolvedValue({ data: [{ present: false }], error: null });

    const result = await getCachedStorefrontProductSlugResolution(
      'merchant-1',
      'not-real'
    );

    expect(result).toEqual({ hasError: false, present: false });
  });

  it('fails open on RPC errors', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({ data: null, error: { message: 'missing fn' } });

    const result = await getCachedStorefrontProductSlugResolution(
      'merchant-1',
      'iphone-15'
    );

    expect(result).toEqual({ hasError: true, present: false });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it.each([
    ['object response', { present: true }],
    ['non-boolean present', [{ present: 'true' }]],
    ['empty row array', []],
  ])('fails open on malformed RPC data: %s', async (_label, data) => {
    mockRpc.mockResolvedValue({ data, error: null });

    const result = await getCachedStorefrontProductSlugResolution(
      'merchant-1',
      'iphone-15'
    );

    expect(result).toEqual({ hasError: true, present: false });
  });
});

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260617082800_add_merchant_product_slug_resolution_rpc.sql'
  ),
  'utf8'
);

const uuidResolverMigrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260625053000_extend_product_slug_resolution_uuid.sql'
  ),
  'utf8'
);

describe('merchant product slug-resolution RPC migration contract', () => {
  it('uses a least-privilege security-definer function for public callers', () => {
    expect(migrationSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(migrationSql).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(migrationSql).toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+public\.get_merchant_product_slug_resolution/i
    );
    expect(migrationSql).toMatch(/TO\s+anon,\s+authenticated/i);
  });

  it('only resolves active products or archived aliases whose parent is active', () => {
    expect(migrationSql).toContain("p.status = 'active'");
    expect(migrationSql).toContain("parent.status = 'active'");
    expect(migrationSql).toContain('parent.id = matched.parent_product_id');
    expect(migrationSql).toContain('COALESCE(m.is_published, FALSE) = TRUE');
  });

  it('preserves slug lookup when adding UUID-shaped product id lookup', () => {
    expect(uuidResolverMigrationSql).toContain('p.slug = input.slug');
    expect(uuidResolverMigrationSql).toContain(
      'OR (input.product_id IS NOT NULL AND p.id = input.product_id)'
    );
    expect(uuidResolverMigrationSql).not.toContain(
      'input.product_id IS NULL AND p.slug = input.slug'
    );
  });
});
