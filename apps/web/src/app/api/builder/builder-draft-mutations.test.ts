import { describe, expect, it, vi } from 'vitest';
import { saveBuilderDraft } from './builder-draft-mutations';

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

const draftInput = {
  slug: 'home',
  name: 'Home',
  config: { content: [], root: { title: 'Home' }, zones: {} },
};

describe('saveBuilderDraft', () => {
  it('returns a conflict response when saving against a stale builder draft', async () => {
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'config-1',
                  updated_at: '2026-03-20T18:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        }),
      })),
    };

    const result = await saveBuilderDraft(mockSupabase as never, 'merchant-1', {
      ...draftInput,
      expectedLastUpdated: '2026-03-20T19:00:00.000Z',
    });

    expect(result.response?.status).toBe(409);
  });

  it('inserts a new builder draft when no existing config is present', async () => {
    let pageConfigReads = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        pageConfigReads += 1;
        if (pageConfigReads === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'config-1',
                  updated_at: '2026-03-20T18:10:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        };
      }),
    };

    const result = await saveBuilderDraft(mockSupabase as never, 'merchant-1', {
      ...draftInput,
      expectedLastUpdated: null,
    });

    expect(result.response).toBeUndefined();
    expect(result.lastUpdated).toBe('2026-03-20T18:10:00.000Z');
  });

  it('returns a conflict response when the first-save insert loses the race', async () => {
    let pageConfigReads = 0;
    const mockSupabase = {
      from: vi.fn(() => {
        pageConfigReads += 1;
        if (pageConfigReads === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi
                    .fn()
                    .mockResolvedValue({ data: null, error: null }),
                }),
              }),
            }),
          };
        }
        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi
                .fn()
                .mockResolvedValue({ data: null, error: null }),
            }),
          }),
        };
      }),
    };

    const result = await saveBuilderDraft(mockSupabase as never, 'merchant-1', {
      ...draftInput,
      expectedLastUpdated: null,
    });

    expect(result.response?.status).toBe(409);
  });

  it('updates an existing builder draft when the revision matches', async () => {
    const updateQuery = createUpdateQuery({
      data: { id: 'config-1', updated_at: '2026-03-20T18:05:00.000Z' },
      error: null,
    });
    const mockSupabase = {
      from: vi.fn(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: {
                  id: 'config-1',
                  updated_at: '2026-03-20T18:00:00.000Z',
                },
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue(updateQuery),
      })),
    };

    const result = await saveBuilderDraft(mockSupabase as never, 'merchant-1', {
      ...draftInput,
      expectedLastUpdated: '2026-03-20T18:00:00.000Z',
    });

    expect(result.lastUpdated).toBe('2026-03-20T18:05:00.000Z');
    expect(updateQuery.eq).toHaveBeenNthCalledWith(1, 'id', 'config-1');
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      2,
      'merchant_id',
      'merchant-1'
    );
    expect(updateQuery.eq).toHaveBeenNthCalledWith(
      3,
      'updated_at',
      '2026-03-20T18:00:00.000Z'
    );
  });
});
