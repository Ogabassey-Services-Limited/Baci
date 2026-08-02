import type { Data } from '@puckeditor/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPost } from '@/lib/api-client';
import { saveBuilderDraft } from './save-builder-draft';

type SaveBuilderDraftParams = Parameters<typeof saveBuilderDraft>[0];

vi.mock('@/lib/api-client', () => ({
  apiPost: vi.fn(),
}));

function createToastMock<T extends { toast: unknown }>() {
  return Object.assign(vi.fn(), { promise: vi.fn() }) as unknown as T['toast'];
}

const mockApiPost = vi.mocked(apiPost);

function createParams() {
  return {
    merchantId: 'merchant-1',
    isCurrentRequest: () => true,
    newData: { content: [], root: {}, zones: {} } as Data,
    seoData: {
      description: 'Description',
      keywords: '',
      title: 'Home',
      twitterCard: 'summary_large_image' as const,
    },
    storeSettings: {} as never,
    setupSettings: {} as never,
    expectedLastUpdated: '2026-06-13T00:00:00.000Z',
    setLastUpdated: vi.fn(),
    setSaving: vi.fn(),
    toast: createToastMock<SaveBuilderDraftParams>(),
  };
}

describe('saveBuilderDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saves the draft and records lastUpdated', async () => {
    mockApiPost.mockResolvedValue({ lastUpdated: 'new-date' });
    const params = createParams();

    await expect(saveBuilderDraft(params)).resolves.toBe('new-date');

    expect(params.setSaving).toHaveBeenNthCalledWith(1, true);
    expect(mockApiPost).toHaveBeenCalledWith('/api/builder', {
      merchantId: params.merchantId,
      slug: 'home',
      name: 'Home',
      config: params.newData,
      seo: params.seoData,
      storeSettings: params.storeSettings,
      setupSettings: params.setupSettings,
      expectedLastUpdated: params.expectedLastUpdated,
    });
    expect(params.setLastUpdated).toHaveBeenCalledWith('new-date');
    expect(params.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('returns null and shows a destructive toast when saving fails', async () => {
    mockApiPost.mockRejectedValue(new Error('Network failed'));
    const params = createParams();

    await expect(saveBuilderDraft(params)).resolves.toBeNull();

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Network failed',
      variant: 'destructive',
    });
    expect(params.setSaving).toHaveBeenLastCalledWith(false);
  });

  it('shows the stale draft message for concurrency conflicts', async () => {
    mockApiPost.mockRejectedValue(new Error('Builder draft is out of date'));
    const params = createParams();

    await saveBuilderDraft(params);

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Error',
      description:
        'This page changed in another session. Refresh the builder to continue with the latest version.',
      variant: 'destructive',
    });
  });

  it('suppresses stale merchant completion after an active merchant switch', async () => {
    let resolveSave!: (value: { lastUpdated: string }) => void;
    mockApiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      })
    );
    let isCurrent = true;
    const params = {
      ...createParams(),
      isCurrentRequest: () => isCurrent,
    };
    const save = saveBuilderDraft(params);

    isCurrent = false;
    resolveSave({ lastUpdated: 'merchant-a-date' });

    await expect(save).resolves.toBeNull();
    expect(params.setLastUpdated).not.toHaveBeenCalled();
    expect(params.setSaving).not.toHaveBeenCalledWith(false);
    expect(params.toast).not.toHaveBeenCalled();
  });
});
