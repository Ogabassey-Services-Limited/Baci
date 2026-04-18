import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useBlogEditorTestUtils } from './useBlogEditor.test-utils';

const { createWebViewRef, mocks, reset, useBlogEditor } =
  useBlogEditorTestUtils;

describe('useBlogEditor load state', () => {
  beforeEach(() => {
    reset();
  });

  it('loads the current blog content on mount', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
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

  it('exposes a load error when the route param is missing', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: undefined, webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.errorMessage).toBe('Missing blog post id');
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
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
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
});
