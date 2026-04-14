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
  requestMediaLibraryPermissionsAsync: vi.fn(),
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
    prompt: vi.fn(),
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

import { useBlogEditor } from '@/hooks/useBlogEditor';

describe('useBlogEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({
              data: { content: '<p>Hello world</p>' },
              error: null,
            }),
        }),
      }),
      update: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
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
    expect(result.current.errorMessage).toBeNull();
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
});
