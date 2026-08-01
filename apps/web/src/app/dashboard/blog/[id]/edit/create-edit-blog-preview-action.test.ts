import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { useToast } from '@/hooks/use-toast';

const { mockGetPreviewUrl, mockToast, mockWindowOpen } = vi.hoisted(() => ({
  mockGetPreviewUrl: vi.fn(),
  mockToast: vi.fn(),
  mockWindowOpen: vi.fn(),
}));

vi.mock('../../actions', () => ({
  getPreviewUrl: (...args: unknown[]) => mockGetPreviewUrl(...args),
}));

const { createEditBlogPreviewAction } = await import(
  './create-edit-blog-preview-action'
);

function createAction() {
  return createEditBlogPreviewAction({
    merchantSessionRef: { current: { generation: 0, id: 'merchant-a' } },
    merchantSlug: 'merchant-a',
    postSlug: 'post-a',
    savePost: vi.fn().mockResolvedValue(true),
    toast: mockToast as unknown as ReturnType<typeof useToast>['toast'],
  });
}

describe('createEditBlogPreviewAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.open = mockWindowOpen;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('opens the preview when the initiating merchant session remains active', async () => {
    mockGetPreviewUrl.mockResolvedValue(
      'https://merchant-a.example.com/post-a'
    );

    await createAction()();

    expect(mockWindowOpen).toHaveBeenCalledWith(
      'https://merchant-a.example.com/post-a',
      '_blank'
    );
    expect(mockToast).not.toHaveBeenCalled();
  });

  it('shows an error without opening a preview when the active session URL lookup fails', async () => {
    mockGetPreviewUrl.mockRejectedValue(new Error('Preview lookup failed'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    await createAction()();

    expect(mockWindowOpen).not.toHaveBeenCalled();
    expect(mockToast).toHaveBeenCalledWith({
      title: 'Error',
      description: 'Failed to generate preview link.',
      variant: 'destructive',
    });
  });
});
