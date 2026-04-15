import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBlogEditorTestUtils } from './useBlogEditor.test-utils';

const { createWebViewRef, mocks, reset, useBlogEditor } =
  useBlogEditorTestUtils;

describe('useBlogEditor save flows', () => {
  beforeEach(() => {
    reset();
  });

  it('saves content with a merchant-scoped update query', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.onWebViewMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'save',
            content: '<p>Hello</p><script>alert(1)</script>',
          }),
        },
      });
    });

    await waitFor(() => {
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
      expect(mocks.updateSelect).toHaveBeenCalledWith('id');
      expect(mocks.back).toHaveBeenCalledTimes(1);
    });
  });

  it('keeps save failures out of the fatal load-error state', async () => {
    mocks.updateSingle.mockResolvedValueOnce({
      data: null,
      error: new Error('Failed to save'),
    });

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.onWebViewMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'save',
            content: '<p>Hello</p>',
          }),
        },
      });
    });

    await waitFor(() => {
      expect(mocks.alert).toHaveBeenCalledWith('Error', 'Failed to save');
    });

    expect(result.current.errorMessage).toBeNull();
    expect(result.current.saveErrorMessage).toBe('Failed to save');
    expect(mocks.back).not.toHaveBeenCalled();
  });

  it('aborts save when the editor bridge reports a missing editor element', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.onWebViewMessage({
        nativeEvent: {
          data: JSON.stringify({
            type: 'save_error',
            message: 'Editor unavailable',
          }),
        },
      });
    });

    expect(mocks.update).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Editor unavailable',
      'Editor unavailable'
    );
    expect(result.current.errorMessage).toBeNull();
    expect(result.current.saveErrorMessage).toBeNull();
    expect(mocks.back).not.toHaveBeenCalled();
  });
});
