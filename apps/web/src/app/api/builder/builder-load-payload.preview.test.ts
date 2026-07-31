import { describe, expect, it, vi } from 'vitest';
import { loadBuilderPayload } from './builder-load-payload';

const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';

function createPreviewSupabase(job: Record<string, unknown>) {
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
      if (table === 'ai_jobs') {
        const query = {
          eq: vi.fn().mockReturnThis(),
          maybeSingle: vi.fn().mockResolvedValue({ data: job, error: null }),
        };
        return { select: vi.fn().mockReturnValue(query) };
      }
      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

function completedJob(config: Record<string, unknown>) {
  return {
    id: aiDraftJobId,
    merchant_id: 'merchant-1',
    type: 'storefront_layout_generation',
    status: 'completed',
    output: {
      generatedConfig: config,
      generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
    },
    result_applied_at: null,
  };
}

describe('loadBuilderPayload AI draft previews', () => {
  it('loads completed AI storefront drafts as read-only previews', async () => {
    const aiConfig = {
      content: [{ type: 'Hero', props: { title: 'AI storefront' } }],
      root: { title: 'AI Home' },
      zones: {},
    };
    const result = await loadBuilderPayload(
      createPreviewSupabase(completedJob(aiConfig)) as never,
      'merchant-1',
      'home',
      true,
      aiDraftJobId
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;
    expect(result.data).toMatchObject({
      config: aiConfig,
      canEdit: false,
      previewMode: 'ai_draft',
      aiDraftJobId,
      canApplyAiDraft: true,
      lastUpdated: '2026-04-28T10:00:00.000Z',
    });
  });

  it('keeps view-only staff from applying AI storefront draft previews', async () => {
    const result = await loadBuilderPayload(
      createPreviewSupabase(
        completedJob({ content: [], root: { title: 'Home' }, zones: {} })
      ) as never,
      'merchant-1',
      'home',
      false,
      aiDraftJobId
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;
    expect(result.data).toMatchObject({
      previewMode: 'ai_draft',
      canApplyAiDraft: false,
    });
  });
});
