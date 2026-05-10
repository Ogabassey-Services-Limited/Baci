import { describe, expect, it, vi } from 'vitest';
import { loadAiStorefrontDraftPreview } from './ai-draft-preview';

const aiDraftJobId = '5c0a0676-bd3f-495e-9f98-589f208c0d79';

function createSupabaseMock(job: unknown, error: unknown = null) {
  return {
    from: vi.fn((table: string) => {
      if (table !== 'ai_jobs') throw new Error(`Unexpected table ${table}`);
      const query = {
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: job, error }),
      };
      return {
        select: vi.fn().mockReturnValue(query),
      };
    }),
  };
}

function completedJob(overrides: Record<string, unknown> = {}) {
  return {
    id: aiDraftJobId,
    merchant_id: 'merchant-1',
    type: 'storefront_layout_generation',
    status: 'completed',
    output: {
      generatedConfig: {
        content: [],
        root: { title: 'AI Home' },
        zones: {},
      },
      generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
    },
    result_applied_at: null,
    ...overrides,
  };
}

describe('loadAiStorefrontDraftPreview', () => {
  it('loads a completed AI draft preview', async () => {
    const result = await loadAiStorefrontDraftPreview(
      createSupabaseMock(completedJob()) as never,
      'merchant-1',
      aiDraftJobId,
      true
    );

    expect(result.response).toBeUndefined();
    if (result.response) return;

    expect(result.data.previewMode).toBe('ai_draft');
    expect(result.data.canApplyAiDraft).toBe(true);
    expect(result.data.config.root).toEqual({ title: 'AI Home' });
  });

  it.each([
    [null, 404, 'job_not_found'],
    [completedJob({ status: 'processing' }), 409, 'job_processing'],
    [
      completedJob({ result_applied_at: '2026-04-28T10:30:00.000Z' }),
      410,
      'job_already_applied',
    ],
  ])('returns a distinct response for invalid draft state', async (job, status, code) => {
    const result = await loadAiStorefrontDraftPreview(
      createSupabaseMock(job) as never,
      'merchant-1',
      aiDraftJobId,
      true
    );

    expect(result.response?.status).toBe(status);
    await expect(result.response?.json()).resolves.toEqual(
      expect.objectContaining({ code })
    );
  });

  it('rejects non-object generated configs before parsing', async () => {
    const result = await loadAiStorefrontDraftPreview(
      createSupabaseMock(
        completedJob({
          output: {
            generatedConfig: null,
            generatedAgainstUpdatedAt: '2026-04-28T10:00:00.000Z',
          },
        })
      ) as never,
      'merchant-1',
      aiDraftJobId,
      true
    );

    expect(result.response?.status).toBe(422);
  });
});
