import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loadBuilderPayload,
  publishBuilderDraft,
  saveBuilderDraft,
} from './builder-route-utils';

const { mockGenerateDefaultConfig } = vi.hoisted(() => ({
  mockGenerateDefaultConfig: vi.fn(),
}));

vi.mock('@/lib/builder-defaults', () => ({
  generateDefaultConfig: mockGenerateDefaultConfig,
}));

describe('builder-route-utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {
      // Silence expected degradation logs in tests.
    });
    mockGenerateDefaultConfig.mockResolvedValue({
      content: [],
      root: { title: 'Home' },
      zones: {},
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('marks the builder payload as degraded when page config loading fails', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'merchant-1',
                    business_name: 'Test Store',
                    business_type: 'fashion',
                    brand_colors: null,
                    logo_url: null,
                    hero_image_ids: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'page_configs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: '57014', message: 'statement timeout' },
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await loadBuilderPayload(
      mockSupabase as never,
      'merchant-1',
      'home',
      true
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;

    expect(result.data.degraded).toBe(true);
    expect(result.data.canEdit).toBe(false);
    expect(result.data.degradedReason).toBe('config_load_failed');
  });

  it('falls back to the minimal builder config when generated defaults are invalid', async () => {
    mockGenerateDefaultConfig.mockResolvedValue('not-a-builder-config');

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'merchant-1',
                    business_name: 'Test Store',
                    business_type: 'fashion',
                    brand_colors: null,
                    logo_url: null,
                    hero_image_ids: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'page_configs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await loadBuilderPayload(
      mockSupabase as never,
      'merchant-1',
      'home',
      true
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;

    expect(result.data.degraded).toBe(true);
    expect(result.data.degradedReason).toBe('default_generation_failed');
    expect(result.data.config).toEqual({
      content: [],
      root: { title: 'Home' },
      zones: {},
    });
  });

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
      slug: 'home',
      name: 'Home',
      config: { content: [], root: { title: 'Home' }, zones: {} },
      expectedLastUpdated: '2026-03-20T19:00:00.000Z',
    });

    expect(result.response?.status).toBe(409);
  });

  it('inserts a new builder draft when no existing config is present', async () => {
    let pageConfigReads = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table !== 'page_configs') {
          throw new Error(`Unexpected table ${table}`);
        }

        pageConfigReads += 1;
        if (pageConfigReads === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
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
                  merchant_id: 'merchant-1',
                  page_slug: 'home',
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
      slug: 'home',
      name: 'Home',
      config: { content: [], root: { title: 'Home' }, zones: {} },
      expectedLastUpdated: null,
    });

    expect(result.response).toBeUndefined();
    expect(result.lastUpdated).toBe('2026-03-20T18:10:00.000Z');
  });

  it('returns a conflict response when the first-save insert loses the race', async () => {
    let pageConfigReads = 0;
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table !== 'page_configs') {
          throw new Error(`Unexpected table ${table}`);
        }

        pageConfigReads += 1;
        if (pageConfigReads === 1) {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        return {
          upsert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: null,
                error: null,
              }),
            }),
          }),
        };
      }),
    };

    const result = await saveBuilderDraft(mockSupabase as never, 'merchant-1', {
      slug: 'home',
      name: 'Home',
      config: { content: [], root: { title: 'Home' }, zones: {} },
      expectedLastUpdated: null,
    });

    expect(result.response?.status).toBe(409);
  });

  it('returns a conflict response when publishing a stale draft', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table !== 'page_configs') {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: 'config-1',
                    draft_config: {
                      content: [],
                      root: { title: 'Home' },
                      zones: {},
                    },
                    published_config: null,
                    draft_seo: null,
                    draft_store_settings: null,
                    draft_setup_settings: null,
                    updated_at: '2026-03-20T18:10:00.000Z',
                  },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }),
    };

    const result = await publishBuilderDraft(
      mockSupabase as never,
      'merchant-1',
      {
        slug: 'home',
        expectedLastUpdated: '2026-03-20T18:00:00.000Z',
      }
    );

    expect(result.response?.status).toBe(409);
  });

  it('updates an existing builder draft when the revision matches', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table !== 'page_configs') {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
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
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                select: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'config-1',
                      updated_at: '2026-03-20T18:05:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }),
    };

    const result = await saveBuilderDraft(mockSupabase as never, 'merchant-1', {
      slug: 'home',
      name: 'Home',
      config: { content: [], root: { title: 'Home' }, zones: {} },
      expectedLastUpdated: '2026-03-20T18:00:00.000Z',
    });

    expect(result.response).toBeUndefined();
    expect(result.lastUpdated).toBe('2026-03-20T18:05:00.000Z');
  });

  it('publishes the current draft when the revision matches', async () => {
    let insertHistoryCalled = false;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'page_configs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'config-1',
                      draft_config: {
                        content: [],
                        root: { title: 'Home' },
                        zones: {},
                      },
                      published_config: {
                        content: [],
                        root: { title: 'Old Home' },
                        zones: {},
                      },
                      draft_seo: null,
                      draft_store_settings: null,
                      draft_setup_settings: null,
                      updated_at: '2026-03-20T18:10:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: {
                        id: 'config-1',
                        updated_at: '2026-03-20T18:12:00.000Z',
                      },
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
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
    };

    const result = await publishBuilderDraft(
      mockSupabase as never,
      'merchant-1',
      {
        slug: 'home',
        expectedLastUpdated: '2026-03-20T18:10:00.000Z',
      }
    );

    expect(insertHistoryCalled).toBe(true);
    expect(result.response).toBeUndefined();
    expect(result.lastUpdated).toBe('2026-03-20T18:12:00.000Z');
  });

  it('does not write history when publish loses the compare-and-swap race', async () => {
    let insertHistoryCalled = false;

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'page_configs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'config-1',
                      draft_config: {
                        content: [],
                        root: { title: 'Home' },
                        zones: {},
                      },
                      published_config: {
                        content: [],
                        root: { title: 'Old Home' },
                        zones: {},
                      },
                      draft_seo: null,
                      draft_store_settings: null,
                      draft_setup_settings: null,
                      updated_at: '2026-03-20T18:10:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  select: vi.fn().mockReturnValue({
                    maybeSingle: vi.fn().mockResolvedValue({
                      data: null,
                      error: null,
                    }),
                  }),
                }),
              }),
            }),
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
    };

    const result = await publishBuilderDraft(
      mockSupabase as never,
      'merchant-1',
      {
        slug: 'home',
        expectedLastUpdated: '2026-03-20T18:10:00.000Z',
      }
    );

    expect(result.response?.status).toBe(409);
    expect(insertHistoryCalled).toBe(false);
  });

  it('respects read-only builder access even when the payload is otherwise healthy', async () => {
    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'merchant-1',
                    business_name: 'Test Store',
                    business_type: 'fashion',
                    brand_colors: null,
                    logo_url: null,
                    hero_image_ids: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'page_configs') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: 'config-1',
                      draft_config: {
                        content: [],
                        root: { title: 'Home' },
                        zones: {},
                      },
                      published_config: null,
                      draft_seo: null,
                      draft_store_settings: null,
                      draft_setup_settings: null,
                      is_published: false,
                      updated_at: '2026-03-20T18:00:00.000Z',
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await loadBuilderPayload(
      mockSupabase as never,
      'merchant-1',
      'home',
      false
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;

    expect(result.data.degraded).toBe(false);
    expect(result.data.canEdit).toBe(false);
  });

  it('loads completed AI storefront drafts as read-only previews', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';
    const aiConfig = {
      content: [{ type: 'Hero', props: { title: 'AI storefront' } }],
      root: { title: 'AI Home' },
      zones: {},
    };

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'merchant-1',
                    business_name: 'Test Store',
                    business_type: 'fashion',
                    brand_colors: null,
                    logo_url: null,
                    hero_image_ids: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'ai_jobs') {
          const query = {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: aiDraftJobId,
                merchant_id: 'merchant-1',
                type: 'storefront_layout_generation',
                status: 'completed',
                output: {
                  generatedConfig: aiConfig,
                  generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
                },
                result_applied_at: null,
              },
              error: null,
            }),
          };

          return {
            select: vi.fn().mockReturnValue(query),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await loadBuilderPayload(
      mockSupabase as never,
      'merchant-1',
      'home',
      true,
      aiDraftJobId
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;

    expect(result.data.config).toEqual(aiConfig);
    expect(result.data.canEdit).toBe(false);
    expect(result.data.previewMode).toBe('ai_draft');
    expect(result.data.aiDraftJobId).toBe(aiDraftJobId);
    expect(result.data.canApplyAiDraft).toBe(true);
    expect(result.data.lastUpdated).toBe('2026-04-28T10:00:00.000Z');
  });

  it('keeps view-only staff from applying AI storefront draft previews', async () => {
    const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';

    const mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'merchants') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'merchant-1',
                    business_name: 'Test Store',
                    business_type: 'fashion',
                    brand_colors: null,
                    logo_url: null,
                    hero_image_ids: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }

        if (table === 'ai_jobs') {
          const query = {
            eq: vi.fn().mockReturnThis(),
            maybeSingle: vi.fn().mockResolvedValue({
              data: {
                id: aiDraftJobId,
                merchant_id: 'merchant-1',
                type: 'storefront_layout_generation',
                status: 'completed',
                output: {
                  generatedConfig: {
                    content: [],
                    root: { title: 'Home' },
                    zones: {},
                  },
                  generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
                },
                result_applied_at: null,
              },
              error: null,
            }),
          };

          return {
            select: vi.fn().mockReturnValue(query),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    };

    const result = await loadBuilderPayload(
      mockSupabase as never,
      'merchant-1',
      'home',
      false,
      aiDraftJobId
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;

    expect(result.data.previewMode).toBe('ai_draft');
    expect(result.data.canApplyAiDraft).toBe(false);
  });
});
