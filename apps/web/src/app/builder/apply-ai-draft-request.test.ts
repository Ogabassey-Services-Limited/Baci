import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchWithCsrf } from '@/lib/api-client';
import { applyAiDraftRequest } from './apply-ai-draft-request';

type ApplyAiDraftRequestParams = Parameters<typeof applyAiDraftRequest>[0];

vi.mock('@/lib/api-client', () => ({
  fetchWithCsrf: vi.fn(),
}));

function createToastMock<T extends { toast: unknown }>() {
  return Object.assign(vi.fn(), { promise: vi.fn() }) as unknown as T['toast'];
}

const mockFetchWithCsrf = vi.mocked(fetchWithCsrf);

function jsonResponse(body: unknown, options: { ok: boolean; status: number }) {
  return {
    ok: options.ok,
    status: options.status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

function createParams(force = false) {
  return {
    aiDraftJobId: 'job-123',
    force,
    merchantId: '11111111-1111-4111-8111-111111111111',
    isCurrentRequest: () => true,
    router: { push: vi.fn() } as unknown as ApplyAiDraftRequestParams['router'],
    toast: createToastMock<ApplyAiDraftRequestParams>(),
    setShowStaleAiDraftDialog: vi.fn(),
    setApplyingAiDraft: vi.fn(),
    setLastUpdated: vi.fn(),
    setCanEdit: vi.fn(),
    setDegradedReason: vi.fn(),
    setPreviewMode: vi.fn(),
    setAiDraftJobId: vi.fn(),
    setCanApplyAiDraft: vi.fn(),
  };
}

describe('applyAiDraftRequest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies an AI draft and resets preview state', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ lastUpdated: 'updated-at' }, { ok: true, status: 200 })
    );
    const params = createParams();

    await applyAiDraftRequest(params);

    expect(params.setApplyingAiDraft).toHaveBeenNthCalledWith(1, true);
    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/ai-jobs/job-123/apply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: '11111111-1111-4111-8111-111111111111',
        }),
      }
    );
    expect(params.setLastUpdated).toHaveBeenCalledWith('updated-at');
    expect(params.toast).toHaveBeenCalledWith({
      title: 'AI design applied',
      description: 'The generated storefront is now your editable draft.',
    });
    expect(params.setCanEdit).toHaveBeenCalledWith(true);
    expect(params.setDegradedReason).toHaveBeenCalledWith(null);
    expect(params.setPreviewMode).toHaveBeenCalledWith(null);
    expect(params.setAiDraftJobId).toHaveBeenCalledWith(null);
    expect(params.setCanApplyAiDraft).toHaveBeenCalledWith(false);
    expect(params.router.push).toHaveBeenCalledWith('/builder');
    expect(params.setApplyingAiDraft).toHaveBeenLastCalledWith(false);
  });

  it('passes force when requested', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({}, { ok: true, status: 200 })
    );
    const params = createParams(true);

    await applyAiDraftRequest(params);

    expect(mockFetchWithCsrf).toHaveBeenCalledWith(
      '/api/ai-jobs/job-123/apply',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchantId: '11111111-1111-4111-8111-111111111111',
          force: true,
        }),
      }
    );
  });

  it('opens the stale draft dialog on non-forced stale conflicts', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ code: 'ai_draft_stale' }, { ok: false, status: 409 })
    );
    const params = createParams();

    await applyAiDraftRequest(params);

    expect(params.setShowStaleAiDraftDialog).toHaveBeenCalledWith(true);
    expect(params.toast).not.toHaveBeenCalled();
    expect(params.setApplyingAiDraft).toHaveBeenLastCalledWith(false);
  });

  it('does not let a stale merchant apply response mutate the next merchant preview', async () => {
    let resolveResponse!: (response: Response) => void;
    mockFetchWithCsrf.mockReturnValue(
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );
    let isCurrent = true;
    const params = {
      ...createParams(),
      isCurrentRequest: () => isCurrent,
    };
    const apply = applyAiDraftRequest(params);

    isCurrent = false;
    resolveResponse(
      jsonResponse({ code: 'ai_draft_stale' }, { ok: false, status: 409 })
    );

    await apply;
    expect(params.setShowStaleAiDraftDialog).not.toHaveBeenCalled();
    expect(params.setLastUpdated).not.toHaveBeenCalled();
    expect(params.setPreviewMode).not.toHaveBeenCalled();
    expect(params.setCanEdit).not.toHaveBeenCalled();
    expect(params.toast).not.toHaveBeenCalled();
    expect(params.router.push).not.toHaveBeenCalled();
    expect(params.setApplyingAiDraft).toHaveBeenCalledTimes(1);
    expect(params.setApplyingAiDraft).toHaveBeenCalledWith(true);
  });

  it('shows a destructive toast for non-ok errors', async () => {
    mockFetchWithCsrf.mockResolvedValue(
      jsonResponse({ error: 'Apply failed' }, { ok: false, status: 500 })
    );
    const params = createParams();

    await applyAiDraftRequest(params);

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Failed to apply AI design',
      description: 'Apply failed',
      variant: 'destructive',
    });
    expect(params.setApplyingAiDraft).toHaveBeenLastCalledWith(false);
  });

  it('shows a destructive toast for network failures', async () => {
    mockFetchWithCsrf.mockRejectedValue(new Error('Network failed'));
    const params = createParams();

    await applyAiDraftRequest(params);

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Failed to apply AI design',
      description: 'Network failed',
      variant: 'destructive',
    });
    expect(params.setApplyingAiDraft).toHaveBeenLastCalledWith(false);
  });
});
