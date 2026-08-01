import { act, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { useToast } from '@/hooks/use-toast';
import { INITIAL_FORM_DATA } from './edit-blog-form-data';
import { useEditBlogDraftRecovery } from './use-edit-blog-draft-recovery';

describe('useEditBlogDraftRecovery', () => {
  it('restores a persisted draft once and gives the merchant an undo action', async () => {
    const clearSavedData = vi.fn();
    const setFormData = vi.fn();
    const setEditorResetKey = vi.fn();
    const mockToast = vi.fn();
    const toast = Object.assign(mockToast, {
      promise: vi.fn(),
    }) as unknown as ReturnType<typeof useToast>['toast'];
    const saved = {
      ...INITIAL_FORM_DATA,
      content: 'Recovered content',
      featured_image_width: undefined,
      featured_image_height: undefined,
      featured_image_variants: undefined,
    };
    const { result } = renderHook(() =>
      useEditBlogDraftRecovery({
        persistence: {
          clearSavedData,
          getSavedData: vi.fn(() => ({ data: saved, savedAt: new Date() })),
          hasSavedData: vi.fn(() => true),
        },
        scopeKey: 'merchant-a:post-1',
        setEditorResetKey,
        setFormData,
        toast,
      })
    );

    act(() => result.current({ ...INITIAL_FORM_DATA, title: 'Saved title' }));
    act(() =>
      result.current({ ...INITIAL_FORM_DATA, title: 'Ignored repeat' })
    );

    expect(setFormData).toHaveBeenCalledTimes(1);
    expect(setFormData).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Recovered content',
        featured_image_height: null,
        featured_image_variants: {},
        featured_image_width: null,
      })
    );
    expect(setEditorResetKey).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Draft Recovered' })
    );

    const recoveredToast = mockToast.mock.calls[0]?.[0] as {
      action: ReactNode;
    };
    render(recoveredToast.action);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Undo' }));

    expect(setFormData).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Saved title' })
    );
    expect(clearSavedData).toHaveBeenCalledTimes(1);
    expect(mockToast).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'Recovery Undone' })
    );
  });

  it('allows a separate merchant editor session to recover its own draft', () => {
    const setFormData = vi.fn();
    const { result, rerender } = renderHook(
      ({ scopeKey }: { scopeKey: string }) =>
        useEditBlogDraftRecovery({
          persistence: {
            clearSavedData: vi.fn(),
            getSavedData: vi.fn(() => ({
              data: { ...INITIAL_FORM_DATA, title: scopeKey },
              savedAt: new Date(),
            })),
            hasSavedData: vi.fn(() => true),
          },
          scopeKey,
          setEditorResetKey: vi.fn(),
          setFormData,
          toast: vi.fn() as unknown as ReturnType<typeof useToast>['toast'],
        }),
      { initialProps: { scopeKey: 'merchant-a:post-1' } }
    );

    result.current({ ...INITIAL_FORM_DATA });
    rerender({ scopeKey: 'merchant-b:post-1' });
    result.current({ ...INITIAL_FORM_DATA });

    expect(setFormData).toHaveBeenCalledTimes(2);
    expect(setFormData).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: 'merchant-b:post-1' })
    );
  });
});
