import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  selectEqId: vi.fn(),
  selectEqMerchant: vi.fn(),
  selectSingle: vi.fn(),
  update: vi.fn(),
  updateEqId: vi.fn(),
  updateEqMerchant: vi.fn(),
  updateSelect: vi.fn(),
  updateSingle: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: mocks.from,
  },
}));

import { useBlogEditorData } from '@/hooks/blog-editor/useBlogEditorData';

describe('useBlogEditorData', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.selectSingle.mockResolvedValue({
      data: { content: '<p>Hello world</p>' },
      error: null,
    });
    mocks.selectEqMerchant.mockReturnValue({
      single: mocks.selectSingle,
    });
    mocks.selectEqId.mockReturnValue({
      eq: mocks.selectEqMerchant,
    });

    mocks.updateSingle.mockResolvedValue({
      data: { id: 'post-1' },
      error: null,
    });
    mocks.updateSelect.mockReturnValue({
      single: mocks.updateSingle,
    });
    mocks.updateEqMerchant.mockReturnValue({
      select: mocks.updateSelect,
    });
    mocks.updateEqId.mockReturnValue({
      eq: mocks.updateEqMerchant,
    });
    mocks.update.mockReturnValue({
      eq: mocks.updateEqId,
    });

    mocks.from.mockReturnValue({
      select: () => ({
        eq: mocks.selectEqId,
      }),
      update: mocks.update,
    });
  });

  it('loads content with merchant-scoped queries', async () => {
    const { result } = renderHook(() =>
      useBlogEditorData({
        isMerchantLoading: false,
        merchantId: 'merchant-1',
        postId: 'post-1',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.content).toBe('<p>Hello world</p>');
    expect(result.current.initialEditorContent).toBe('<p>Hello world</p>');
    expect(result.current.errorMessage).toBeNull();
    expect(mocks.selectEqId).toHaveBeenCalledWith('id', 'post-1');
    expect(mocks.selectEqMerchant).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
  });

  it('retries loading after an initial fetch failure', async () => {
    mocks.selectSingle
      .mockResolvedValueOnce({
        data: null,
        error: new Error('Failed to load content'),
      })
      .mockResolvedValueOnce({
        data: { content: '<p>Recovered</p>' },
        error: null,
      });

    const { result } = renderHook(() =>
      useBlogEditorData({
        isMerchantLoading: false,
        merchantId: 'merchant-1',
        postId: 'post-1',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.errorMessage).toBe('Failed to load content');

    act(() => {
      result.current.retryLoad();
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
      expect(result.current.errorMessage).toBeNull();
    });

    expect(result.current.content).toBe('<p>Recovered</p>');
  });

  it('saves sanitized content and triggers the success callback', async () => {
    const onSaveSuccess = vi.fn();
    const { result } = renderHook(() =>
      useBlogEditorData({
        isMerchantLoading: false,
        merchantId: 'merchant-1',
        onSaveSuccess,
        postId: 'post-1',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await act(async () => {
      await result.current.saveContent('<p>Hello</p><script>alert(1)</script>');
    });

    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        content: '<p>Hello</p>',
        updated_at: expect.any(String),
      })
    );
    expect(mocks.updateEqId).toHaveBeenCalledWith('id', 'post-1');
    expect(mocks.updateEqMerchant).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    expect(result.current.content).toBe('<p>Hello</p>');
    expect(result.current.initialEditorContent).toBe('<p>Hello</p>');
    expect(result.current.isSaving).toBe(false);
    expect(result.current.saveErrorMessage).toBeNull();
    expect(onSaveSuccess).toHaveBeenCalledTimes(1);
  });

  it('surfaces save failures without calling the success callback', async () => {
    const onSaveSuccess = vi.fn();
    mocks.updateSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('Failed to save'),
    });

    const { result } = renderHook(() =>
      useBlogEditorData({
        isMerchantLoading: false,
        merchantId: 'merchant-1',
        onSaveSuccess,
        postId: 'post-1',
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    let saveError: unknown;

    await act(async () => {
      try {
        await result.current.saveContent('<p>Test</p>');
      } catch (error) {
        saveError = error;
      }
    });

    expect(saveError).toBeInstanceOf(Error);
    expect((saveError as Error).message).toBe('Failed to save');
    expect(result.current.isSaving).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.saveErrorMessage).toBe('Failed to save');
    expect(onSaveSuccess).not.toHaveBeenCalled();
  });
});
