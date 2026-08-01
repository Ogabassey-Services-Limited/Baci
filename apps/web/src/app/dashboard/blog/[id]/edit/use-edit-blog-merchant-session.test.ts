import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useEditBlogSession } from './use-edit-blog-merchant-session';

describe('useEditBlogSession', () => {
  it('does not advance the generation or clear saving for an unchanged merchant', () => {
    const setIsSaving = vi.fn();
    const { result, rerender } = renderHook(
      ({ merchantId }: { merchantId: string | undefined }) =>
        useEditBlogSession(merchantId, setIsSaving),
      { initialProps: { merchantId: 'merchant-a' } }
    );

    rerender({ merchantId: 'merchant-a' });

    expect(result.current.current).toEqual({ generation: 0, id: 'merchant-a' });
    expect(setIsSaving).not.toHaveBeenCalled();
  });

  it('creates a new generation and clears saving on every merchant transition', () => {
    const setIsSaving = vi.fn();
    const { result, rerender } = renderHook(
      ({ merchantId }: { merchantId: string | undefined }) =>
        useEditBlogSession(merchantId, setIsSaving),
      { initialProps: { merchantId: 'merchant-a' } }
    );

    rerender({ merchantId: 'merchant-b' });
    rerender({ merchantId: 'merchant-a' });

    expect(result.current.current).toEqual({ generation: 2, id: 'merchant-a' });
    expect(setIsSaving).toHaveBeenCalledTimes(2);
    expect(setIsSaving).toHaveBeenLastCalledWith(false);
  });
});
