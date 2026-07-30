import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import type { BuilderToast } from './builder-client-types';
import { useBuilderAiDraftActions } from './use-builder-ai-draft-actions';

vi.mock('@/lib/api-client', () => ({ fetchWithCsrf: vi.fn() }));

const mockFetchWithCsrf = vi.mocked(fetchWithCsrf);

describe('useBuilderAiDraftActions', () => {
  it('keeps an in-flight merchant A apply from opening a stale dialog for merchant B', async () => {
    let resolveResponse!: (response: Response) => void;
    mockFetchWithCsrf.mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );
    let merchantId = 'merchant-a';
    const setShowStaleAiDraftDialog = vi.fn();
    const setApplyingAiDraft = vi.fn();
    const setLastUpdated = vi.fn();
    const setPreviewMode = vi.fn();
    const { result, rerender } = renderHook(() =>
      useBuilderAiDraftActions({
        aiDraftJobId: 'job-a',
        canApplyAiDraft: true,
        canEdit: true,
        data: { content: [], root: {}, zones: {} } as never,
        degradedReason: null,
        merchantId,
        previewMode: 'ai_draft',
        router: { push: vi.fn() } as never,
        setAiDraftJobId: vi.fn(),
        setApplyingAiDraft,
        setCanApplyAiDraft: vi.fn(),
        setCanEdit: vi.fn(),
        setData: vi.fn(),
        setDegradedReason: vi.fn(),
        setIsAiLoading: vi.fn(),
        setLastUpdated,
        setPreviewMode,
        setShowStaleAiDraftDialog,
        toast: vi.fn() as unknown as BuilderToast,
      })
    );

    let apply!: Promise<void>;
    act(() => {
      apply = result.current.applyAiDraft();
    });
    await waitFor(() => expect(mockFetchWithCsrf).toHaveBeenCalledTimes(1));

    merchantId = 'merchant-b';
    rerender();
    resolveResponse({
      ok: false,
      status: 409,
      json: async () => ({ code: 'ai_draft_stale' }),
    } as Response);

    await apply;
    expect(setShowStaleAiDraftDialog).not.toHaveBeenCalledWith(true);
    expect(setLastUpdated).not.toHaveBeenCalled();
    expect(setPreviewMode).not.toHaveBeenCalled();
    expect(setApplyingAiDraft).toHaveBeenLastCalledWith(false);
  });
});
