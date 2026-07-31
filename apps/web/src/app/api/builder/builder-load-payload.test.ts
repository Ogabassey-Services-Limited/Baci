import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadBuilderPayload } from './builder-load-payload';

const { mockGenerateDefaultConfig } = vi.hoisted(() => ({
  mockGenerateDefaultConfig: vi.fn(),
}));

vi.mock('@/lib/builder-defaults', () => ({
  generateDefaultConfig: mockGenerateDefaultConfig,
}));

function createSupabaseMock(pageConfig: unknown, error: unknown = null) {
  return {
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
                  data: pageConfig,
                  error,
                }),
              }),
            }),
          }),
        };
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe('loadBuilderPayload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
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
    const result = await loadBuilderPayload(
      createSupabaseMock(null, {
        code: '57014',
        message: 'statement timeout',
      }) as never,
      'merchant-1',
      'home',
      true
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;
    expect(result.data).toMatchObject({
      degraded: true,
      canEdit: false,
      degradedReason: 'config_load_failed',
    });
  });

  it('falls back to the minimal builder config when generated defaults are invalid', async () => {
    mockGenerateDefaultConfig.mockResolvedValue('not-a-builder-config');

    const result = await loadBuilderPayload(
      createSupabaseMock(null) as never,
      'merchant-1',
      'home',
      true
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;
    expect(result.data).toMatchObject({
      config: { content: [], root: { title: 'Home' }, zones: {} },
      degraded: true,
      degradedReason: 'default_generation_failed',
    });
  });

  it('respects read-only builder access even when the payload is otherwise healthy', async () => {
    const result = await loadBuilderPayload(
      createSupabaseMock({
        id: 'config-1',
        draft_config: { content: [], root: { title: 'Home' }, zones: {} },
        published_config: null,
        draft_seo: null,
        draft_store_settings: null,
        draft_setup_settings: null,
        is_published: false,
        updated_at: '2026-03-20T18:00:00.000Z',
      }) as never,
      'merchant-1',
      'home',
      false
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;
    expect(result.data).toMatchObject({ degraded: false, canEdit: false });
  });
});
