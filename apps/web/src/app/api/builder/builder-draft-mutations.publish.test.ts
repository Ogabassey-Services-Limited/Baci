import { describe, expect, it, vi } from 'vitest';
import { publishBuilderDraft } from './builder-draft-mutations';

function createUpdateQuery(result: { data: unknown; error: unknown }) {
  const query = {
    eq: vi.fn(),
    select: vi.fn().mockReturnValue({
      maybeSingle: vi.fn().mockResolvedValue(result),
    }),
  };
  query.eq.mockReturnValue(query);
  return query;
}

function currentDraft() {
  return {
    id: 'config-1',
    draft_config: { content: [], root: { title: 'Home' }, zones: {} },
    published_config: { content: [], root: { title: 'Old Home' }, zones: {} },
    draft_seo: null,
    draft_store_settings: null,
    draft_setup_settings: null,
    updated_at: '2026-03-20T18:10:00.000Z',
  };
}

function createSupabaseMock(
  record: Record<string, unknown>,
  updateQuery?: ReturnType<typeof createUpdateQuery>
) {
  let insertHistoryCalled = false;
  return {
    supabase: {
      from: vi.fn((table: string) => {
        if (table === 'page_configs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: record, error: null }),
                }),
              }),
            }),
            ...(updateQuery
              ? { update: vi.fn().mockReturnValue(updateQuery) }
              : {}),
          };
        }
        if (table === 'page_config_history') {
          return {
            insert: vi.fn().mockImplementation(() => {
              insertHistoryCalled = true;
              return Promise.resolve({ error: null });
            }),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
    },
    wasHistoryInserted: () => insertHistoryCalled,
  };
}

describe('publishBuilderDraft', () => {
  it('returns a conflict response when publishing a stale draft', async () => {
    const { supabase } = createSupabaseMock(currentDraft());
    const result = await publishBuilderDraft(supabase as never, 'merchant-1', {
      slug: 'home',
      expectedLastUpdated: '2026-03-20T18:00:00.000Z',
    });

    expect(result.response?.status).toBe(409);
  });

  it('publishes the current draft when the revision matches', async () => {
    const updateQuery = createUpdateQuery({
      data: { id: 'config-1', updated_at: '2026-03-20T18:12:00.000Z' },
      error: null,
    });
    const { supabase, wasHistoryInserted } = createSupabaseMock(
      currentDraft(),
      updateQuery
    );
    const result = await publishBuilderDraft(supabase as never, 'merchant-1', {
      slug: 'home',
      expectedLastUpdated: '2026-03-20T18:10:00.000Z',
    });

    expect(wasHistoryInserted()).toBe(true);
    expect(result.lastUpdated).toBe('2026-03-20T18:12:00.000Z');
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'config-1');
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      2,
      'merchant_id',
      'merchant-1'
    );
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      3,
      'updated_at',
      '2026-03-20T18:10:00.000Z'
    );
  });

  it('does not write history when publish loses the compare-and-swap race', async () => {
    const updateQuery = createUpdateQuery({ data: null, error: null });
    const { supabase, wasHistoryInserted } = createSupabaseMock(
      currentDraft(),
      updateQuery
    );
    const result = await publishBuilderDraft(supabase as never, 'merchant-1', {
      slug: 'home',
      expectedLastUpdated: '2026-03-20T18:10:00.000Z',
    });

    expect(result.response?.status).toBe(409);
    expect(wasHistoryInserted()).toBe(false);
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'config-1');
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      2,
      'merchant_id',
      'merchant-1'
    );
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      3,
      'updated_at',
      '2026-03-20T18:10:00.000Z'
    );
  });
});
