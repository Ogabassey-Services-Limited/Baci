import { afterEach, describe, expect, it, vi } from 'vitest';

type QueryResult = { count: number | null; error: { message: string } | null };
type QueryCall = { method: string; args: unknown[] };
type QueryRecord = { table: string; calls: QueryCall[] };
type QueryChain = Promise<QueryResult> & {
  eq: (...args: unknown[]) => QueryChain;
  ilike: (...args: unknown[]) => QueryChain;
  neq: (...args: unknown[]) => QueryChain;
  select: (...args: unknown[]) => QueryChain;
};

const mocks = vi.hoisted(() => {
  const chains: QueryRecord[] = [];
  const fetchCandidates = vi.fn(async () => []);

  function makeChain(table: string): QueryChain {
    const record: QueryRecord = { calls: [], table };
    chains.push(record);
    const chain = Promise.resolve({
      count: 0,
      error: null,
    }) as QueryChain;
    const passthrough =
      (method: string) =>
      (...args: unknown[]) => {
        record.calls.push({ args, method });
        return chain;
      };

    chain.eq = passthrough('eq');
    chain.ilike = passthrough('ilike');
    chain.neq = passthrough('neq');
    chain.select = passthrough('select');

    return chain;
  }

  return {
    chains,
    fetchCandidates,
    from: vi.fn((table: string) => makeChain(table)),
    reset: () => {
      chains.length = 0;
      fetchCandidates.mockClear();
    },
  };
});

import {
  assertNoDuplicateProduct,
  escapePostgresLikePattern,
  isDuplicateConstraintError,
  toProductSlug,
} from './product-duplicate';

vi.mock('@baci/shared', () => ({
  normalizeProductSearchText: (value: string) => value.toLowerCase(),
}));

vi.mock('@/lib/product-search', () => ({
  fetchAdminProductSuggestionCandidates: mocks.fetchCandidates,
}));

vi.mock('@/lib/supabase', () => ({
  supabase: { from: mocks.from },
}));

describe('product duplicate helpers', () => {
  afterEach(() => {
    mocks.reset();
  });

  it('normalizes product names into slugs', () => {
    expect(toProductSlug('  iPhone 15 Pro Max!!! ')).toBe('iphone-15-pro-max');
  });

  it('detects database and text duplicate errors', () => {
    expect(
      isDuplicateConstraintError({ code: '23505', message: 'unique' })
    ).toBe(true);
    expect(isDuplicateConstraintError({ message: 'duplicate key value' })).toBe(
      true
    );
    expect(isDuplicateConstraintError({ message: 'other error' })).toBe(false);
  });

  it('escapes PostgreSQL LIKE wildcard characters', () => {
    expect(escapePostgresLikePattern(String.raw`100% Cotton_Pro\Max`)).toBe(
      String.raw`100\% Cotton\_Pro\\Max`
    );
  });

  it('uses an escaped exact ilike pattern for product names', async () => {
    await assertNoDuplicateProduct({
      merchantId: 'merchant-1',
      productName: String.raw`100% Cotton_Pro\Max`,
    });

    const ilikeCall = mocks.chains
      .flatMap((chain) => chain.calls)
      .find((call) => call.method === 'ilike');

    expect(ilikeCall).toEqual({
      args: ['name', String.raw`100\% Cotton\_Pro\\Max`],
      method: 'ilike',
    });
  });
});
