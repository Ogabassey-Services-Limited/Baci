import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBlogEditorTestUtils } from './useBlogEditor.test-utils';

const { createWebViewRef, mocks, reset, useBlogEditor } =
  useBlogEditorTestUtils;

describe('useBlogEditor command flows', () => {
  beforeEach(() => {
    reset();
  });

  it('sanitizes content updates from valid WebView messages', async () => {
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
            type: 'content_change',
            content: '<p>Hello</p><script>alert(1)</script>',
          }),
        },
      });
    });

    expect(result.current.content).toBe('<p>Hello</p>');
  });

  it('ignores malformed WebView messages that fail schema validation', async () => {
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
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
          }),
        },
      });
    });

    expect(mocks.update).not.toHaveBeenCalled();
    expect(result.current.content).toBe('<p>Hello world</p>');
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'WebView message parse error: invalid message format'
    );

    consoleErrorSpy.mockRestore();
  });

  it('normalizes links before injecting them into the editor', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openLinkModal();
      result.current.setLinkUrl('baci.com');
    });

    await waitFor(() => {
      expect(result.current.linkUrl).toBe('baci.com');
    });

    act(() => {
      result.current.handleInsertLink();
    });

    await waitFor(() => {
      expect(mocks.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('https://baci.com')
      );
      expect(result.current.linkUrl).toBe('');
      expect(result.current.isLinkModalVisible).toBe(false);
    });
  });

  it('rejects unsafe link protocols before injecting them into the editor', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openLinkModal();
      result.current.setLinkUrl('javascript:alert(1)');
    });

    await waitFor(() => {
      expect(result.current.linkUrl).toBe('javascript:alert(1)');
    });

    act(() => {
      result.current.handleInsertLink();
    });

    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Invalid link',
      'Enter a valid http or https URL.'
    );
    expect(result.current.linkUrl).toBe('javascript:alert(1)');
    expect(result.current.isLinkModalVisible).toBe(true);
  });

  it('keeps the link modal open when the editor is unavailable', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({
        id: 'post-1',
        webViewRef: { current: null },
      })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.openLinkModal();
      result.current.setLinkUrl('https://baci.com');
    });

    act(() => {
      result.current.handleInsertLink();
    });

    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Editor unavailable',
      'Please wait for the editor to finish loading.'
    );
    expect(result.current.linkUrl).toBe('https://baci.com');
    expect(result.current.isLinkModalVisible).toBe(true);
  });

  it('opens a cross-platform video dialog and inserts videos through the WebView', async () => {
    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef: createWebViewRef() })
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.handleInsertVideo();
      result.current.setVideoUrl('https://youtu.be/ABCDEFGHIJK');
    });

    await waitFor(() => {
      expect(result.current.isVideoModalVisible).toBe(true);
    });

    act(() => {
      result.current.confirmInsertVideo();
    });

    await waitFor(() => {
      expect(mocks.injectJavaScript).toHaveBeenCalledWith(
        expect.stringContaining('ABCDEFGHIJK')
      );
      expect(result.current.videoUrl).toBe('');
      expect(result.current.isVideoModalVisible).toBe(false);
    });
  });
});
