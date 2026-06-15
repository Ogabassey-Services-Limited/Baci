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

import { getCachedStorefrontProductSlugSet } from '@/lib/cached-storefront-product-slug-set';

describe('getCachedStorefrontProductSlugSet', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreatePublicClient.mockReturnValue({ rpc: mockRpc });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the merchant slug set from the RPC', async () => {
    mockRpc.mockResolvedValue({
      data: ['iphone-15', 'macbook-air-m1'],
      error: null,
    });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result).toEqual({
      hasError: false,
      slugs: ['iphone-15', 'macbook-air-m1'],
    });
  });

  it('uses the anon public client + the slug-set RPC scoped to the merchant', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });

    await getCachedStorefrontProductSlugSet('merchant-abc');

    expect(mockCreatePublicClient).toHaveBeenCalledWith(
      expect.objectContaining({ clientInfo: 'storefront-product-slug-set' })
    );
    expect(mockRpc).toHaveBeenCalledWith('get_merchant_product_slug_set', {
      p_merchant_id: 'merchant-abc',
    });
  });

  it('trims and drops null/blank slugs defensively', async () => {
    mockRpc.mockResolvedValue({
      data: ['real', null, '  ', '  spaced  '],
      error: null,
    });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result.slugs).toEqual(['real', 'spaced']);
  });

  it('fails open (hasError + empty) on an RPC error', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: 'Connection refused' },
    });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result).toEqual({ hasError: true, slugs: [] });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('returns empty (no error) when the RPC returns null data', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    const result = await getCachedStorefrontProductSlugSet('merchant-1');

    expect(result).toEqual({ hasError: false, slugs: [] });
  });
});

const migrationSql = readFileSync(
  resolve(
    dirname(fileURLToPath(import.meta.url)),
    '../../../../supabase/migrations/20260615170601_add_merchant_product_slug_set_rpc.sql'
  ),
  'utf8'
);

describe('merchant product slug-set RPC migration contract', () => {
  it('does not expose the private schema to API roles', () => {
    expect(migrationSql).not.toMatch(
      /GRANT\s+USAGE\s+ON\s+SCHEMA\s+private\s+TO\s+anon/i
    );
    expect(migrationSql).not.toMatch(
      /GRANT\s+EXECUTE\s+ON\s+FUNCTION\s+private\./i
    );
  });

  it('keeps the public security-definer RPC constrained to published merchants', () => {
    expect(migrationSql).toMatch(/SECURITY\s+DEFINER/i);
    expect(migrationSql).toMatch(/SET\s+search_path\s*=\s*''/i);
    expect(migrationSql).toContain('FROM public.merchants AS m');
    expect(migrationSql).toContain('COALESCE(m.is_published, FALSE) = TRUE');
  });
});
