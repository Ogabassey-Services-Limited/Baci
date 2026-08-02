import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { useToast } from '@/hooks/use-toast';
import { createEmptyPostFormData } from './new-blog-post-form-data';
import { useNewBlogPostDraftRecovery } from './use-new-blog-post-draft-recovery';

const { getSavedData, hasSavedData } = vi.hoisted(() => ({
  getSavedData: vi.fn(),
  hasSavedData: vi.fn(),
}));

vi.mock('@/hooks/use-blog-auto-save', () => ({
  useBlogAutoSave: () => ({
    clearSavedData: vi.fn(),
    getSavedData,
    hasSavedData,
  }),
}));

describe('useNewBlogPostDraftRecovery', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('signals that the editor must reset after auto-recovering this merchant draft', () => {
    vi.useFakeTimers();
    const setFormData = vi.fn();
    const onContentReset = vi.fn();
    const toast = vi.fn() as unknown as ReturnType<typeof useToast>['toast'];
    getSavedData.mockReturnValue({
      data: {
        ...createEmptyPostFormData('Baci Store'),
        content: 'recovered draft content',
        title: 'Recovered',
      },
    });
    hasSavedData.mockReturnValue(true);

    renderHook(() =>
      useNewBlogPostDraftRecovery({
        businessName: 'Baci Store',
        formData: createEmptyPostFormData('Baci Store'),
        merchantId: 'merchant-1',
        setEditorResetKey: onContentReset,
        setFormData,
        setUploadedFeaturedImage: vi.fn(),
        toast,
      })
    );

    act(() => vi.runAllTimers());

    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({ content: 'recovered draft content' })
    );
    expect(onContentReset).toHaveBeenCalledOnce();
  });
});
