import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockOrder = vi.fn();
const mockIs = vi.fn(() => builder);
const mockEq = vi.fn(() => builder);
const builder = { eq: mockEq, is: mockIs, order: mockOrder };
const mockSelect = vi.fn(() => builder);
const mockFrom = vi.fn(() => ({ select: mockSelect }));
const mockCreateClient = vi.fn((..._args: unknown[]) => ({ from: mockFrom }));

vi.mock('next/cache', () => ({ cacheLife: vi.fn(), cacheTag: vi.fn() }));
vi.mock('@/env', () => ({
  getSupabaseUrl: vi.fn(() => 'https://test.supabase.co'),
  getSupabaseAnonKey: vi.fn(() => 'test-anon-key'),
}));
vi.mock('react', () => ({ cache: vi.fn((fn: unknown) => fn) }));
vi.mock('@supabase/supabase-js', () => ({
  createClient: (...args: unknown[]) => mockCreateClient(...args),
}));

import { cacheLife, cacheTag } from 'next/cache';
import {
  getCachedNavigationCategories,
  getStorefrontNavigationCategories,
} from './cached-categories';

describe('getCachedNavigationCategories', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns categories in the storefront priority order on success', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [
        { name: 'Audio', slug: 'audio' },
        { name: 'Smartphones', slug: 'smartphones' },
      ],
      error: null,
    });

    const result = await getCachedNavigationCategories('merchant-1');

    // smartphones is priority index 0, audio index 5 -> smartphones first.
    expect(result).toEqual([
      { name: 'Smartphones', slug: 'smartphones' },
      { name: 'Audio', slug: 'audio' },
    ]);
    expect(mockEq).toHaveBeenCalledWith('merchant_id', 'merchant-1');
    expect(mockIs).toHaveBeenCalledWith('parent_id', null);
    expect(cacheLife).toHaveBeenCalledWith('categories');
    expect(cacheTag).toHaveBeenCalledWith(
      'categories',
      'navigation-categories',
      'navigation-categories-merchant-1'
    );
  });

  it('throws on a transient error so it is never cached as an empty nav', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { code: '57014', message: 'canceling statement due to timeout' },
    });

    await expect(
      getCachedNavigationCategories('merchant-1')
    ).rejects.toMatchObject({ code: '57014' });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('returns an empty list for a merchant with no top-level categories', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    await expect(getCachedNavigationCategories('merchant-1')).resolves.toEqual(
      []
    );
  });
});

describe('getStorefrontNavigationCategories (request-local fail-open boundary)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('passes successful navigation categories straight through', async () => {
    mockOrder.mockResolvedValueOnce({
      data: [{ name: 'Smartphones', slug: 'smartphones' }],
      error: null,
    });

    await expect(
      getStorefrontNavigationCategories('merchant-1')
    ).resolves.toEqual([{ name: 'Smartphones', slug: 'smartphones' }]);
  });

  it('degrades a transient failure to an empty nav outside the cache scope', async () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockOrder.mockResolvedValueOnce({
      data: null,
      error: { code: '57014', message: 'canceling statement due to timeout' },
    });

    await expect(
      getStorefrontNavigationCategories('merchant-1')
    ).resolves.toEqual([]);
    expect(consoleSpy).toHaveBeenCalledWith(
      'Navigation categories query failed outside cache:',
      expect.objectContaining({ merchantId: 'merchant-1' })
    );
  });
});

describe('cached-categories cache directive', () => {
  const source = readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), 'cached-categories.ts'),
    'utf8'
  );

  it('reads nav categories off the local cache handler with a bounded life', () => {
    // PR4a: ~19-row {name,slug} indexed read (<10ms). No cross-instance need,
    // and the coarse remote SET is the exit-128 write hazard the plan targets.
    expect(source).not.toContain("'use cache: remote';");
    expect(source).toContain("'use cache';");
    expect(source).toContain("cacheLife('categories');");
  });
});
