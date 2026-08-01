import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiPut } from '@/lib/api-client';
import { publishBuilderDraft } from './publish-builder-draft';

type PublishBuilderDraftParams = Parameters<typeof publishBuilderDraft>[0];

vi.mock('@/lib/api-client', () => ({
  apiPut: vi.fn(),
}));

function createToastMock<T extends { toast: unknown }>() {
  return Object.assign(vi.fn(), { promise: vi.fn() }) as unknown as T['toast'];
}

const mockApiPut = vi.mocked(apiPut);

function createParams() {
  return {
    merchantId: 'merchant-1',
    isCurrentRequest: () => true,
    expectedLastUpdated: 'old-date',
    setLastUpdated: vi.fn(),
    setPublishing: vi.fn(),
    toast: createToastMock<PublishBuilderDraftParams>(),
  };
}

describe('publishBuilderDraft', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('publishes the current draft and updates lastUpdated', async () => {
    mockApiPut.mockResolvedValue({ lastUpdated: 'new-date' });
    const params = createParams();

    await publishBuilderDraft(params);

    expect(mockApiPut).toHaveBeenCalledWith('/api/builder', {
      merchantId: params.merchantId,
      slug: 'home',
      expectedLastUpdated: params.expectedLastUpdated,
    });
    expect(params.setLastUpdated).toHaveBeenCalledWith('new-date');
    expect(params.toast).toHaveBeenCalledWith({
      title: 'Published! 🚀',
      description: 'Your changes are now live on your storefront.',
    });
    expect(params.setPublishing).toHaveBeenCalledWith(false);
  });

  it('shows a destructive toast when publishing fails', async () => {
    mockApiPut.mockRejectedValue(new Error('Builder draft is out of date'));
    const params = createParams();

    await publishBuilderDraft(params);

    expect(params.toast).toHaveBeenCalledWith({
      title: 'Error',
      description:
        'This page changed in another session. Refresh the builder to continue with the latest version.',
      variant: 'destructive',
    });
    expect(params.setPublishing).toHaveBeenCalledWith(false);
  });

  it('suppresses stale merchant publication completion after an active merchant switch', async () => {
    let resolvePublish!: (value: { lastUpdated: string }) => void;
    mockApiPut.mockReturnValue(
      new Promise((resolve) => {
        resolvePublish = resolve;
      })
    );
    let isCurrent = true;
    const params = {
      ...createParams(),
      isCurrentRequest: () => isCurrent,
    };
    const publish = publishBuilderDraft(params);

    isCurrent = false;
    resolvePublish({ lastUpdated: 'merchant-a-date' });

    await publish;
    expect(params.setLastUpdated).not.toHaveBeenCalled();
    expect(params.setPublishing).not.toHaveBeenCalledWith(false);
    expect(params.toast).not.toHaveBeenCalled();
  });
});
