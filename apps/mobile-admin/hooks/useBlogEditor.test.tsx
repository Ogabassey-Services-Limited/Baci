import '@testing-library/jest-dom/vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  back: vi.fn(),
  from: vi.fn(),
  getSession: vi.fn(),
  injectJavaScript: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  merchantId: 'merchant-1',
  requestMediaLibraryPermissionsAsync: vi.fn(),
  selectEqId: vi.fn(),
  selectEqMerchant: vi.fn(),
  selectSingle: vi.fn(),
  update: vi.fn(),
  updateEqId: vi.fn(),
  updateEqMerchant: vi.fn(),
  updateSelect: vi.fn(),
  updateSingle: vi.fn(),
}));

vi.mock('expo-router', () => ({
  router: {
    back: mocks.back,
  },
}));

vi.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: mocks.launchImageLibraryAsync,
  requestMediaLibraryPermissionsAsync:
    mocks.requestMediaLibraryPermissionsAsync,
}));

vi.mock('react-native', () => ({
  Alert: {
    alert: mocks.alert,
  },
}));

vi.mock('@/types/upload', () => ({
  asUploadFile: (value: unknown) => value,
}));

vi.mock('@/lib/validators/storage', () => ({
  parseWebViewEditorMessage: (value: string) => JSON.parse(value),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
    from: mocks.from,
  },
}));

vi.mock('@/hooks/useMerchant', () => ({
  useMerchant: () => ({
    isLoading: false,
    merchant: mocks.merchantId ? { id: mocks.merchantId } : null,
  }),
}));

import { useBlogEditor } from '@/hooks/useBlogEditor';

describe('useBlogEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.merchantId = 'merchant-1';

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
    mocks.from.mockReturnValue({
      select: () => ({
        eq: mocks.selectEqId,
      }),
      update: mocks.update,
    });
    mocks.update.mockReturnValue({
      eq: mocks.updateEqId,
    });

    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
  });

  it('loads the current blog content on mount', async () => {
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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

  it('normalizes links before injecting them into the editor', async () => {
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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
    });
    await waitFor(() => {
      expect(result.current.linkUrl).toBe('');
      expect(result.current.isLinkModalVisible).toBe(false);
    });
  });

  it('exposes a load error when the route param is missing', async () => {
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: undefined, webViewRef })
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

    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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

  it('sanitizes content updates from WebView messages', async () => {
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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

  it('saves content with a merchant-scoped update query', async () => {
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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

    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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

  it('opens a cross-platform video dialog and inserts videos through the WebView', async () => {
    const webViewRef = {
      current: { injectJavaScript: mocks.injectJavaScript },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() =>
      useBlogEditor({ id: 'post-1', webViewRef })
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
