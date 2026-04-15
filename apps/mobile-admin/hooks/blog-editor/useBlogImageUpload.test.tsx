import { act, renderHook } from '@testing-library/react';
import type { RefObject } from 'react';
import type { WebView } from 'react-native-webview';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  alert: vi.fn(),
  deleteBlogEditorImage: vi.fn(),
  getSession: vi.fn(),
  injectJavaScript: vi.fn(),
  launchImageLibraryAsync: vi.fn(),
  requestMediaLibraryPermissionsAsync: vi.fn(),
  uploadBlogEditorImageDetails: vi.fn(),
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

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: mocks.getSession,
    },
  },
}));

vi.mock('@/components/blog-editor/blog-editor-api', () => ({
  deleteBlogEditorImage: mocks.deleteBlogEditorImage,
  uploadBlogEditorImageDetails: mocks.uploadBlogEditorImageDetails,
}));

import { useBlogImageUpload } from '@/hooks/blog-editor/useBlogImageUpload';

describe('useBlogImageUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValue({
      granted: true,
    });
    mocks.launchImageLibraryAsync.mockResolvedValue({
      assets: [{ uri: 'file:///hero.png' }],
      canceled: false,
    });
    mocks.getSession.mockResolvedValue({
      data: {
        session: {
          access_token: 'token',
        },
      },
      error: null,
    });
    mocks.uploadBlogEditorImageDetails.mockResolvedValue({
      path: 'merchant-1/blog/hero.png',
      url: 'https://cdn.usebaci.com/hero.png',
    });
  });

  it('alerts and aborts before upload when the editor is unavailable', async () => {
    const webViewRef = { current: null } as RefObject<WebView | null>;
    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Editor unavailable',
      'Please wait for the editor to finish loading.'
    );
    expect(mocks.uploadBlogEditorImageDetails).not.toHaveBeenCalled();
  });

  it('cleans up uploaded assets when the editor disappears before insertion', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;

    mocks.uploadBlogEditorImageDetails.mockImplementationOnce(() =>
      Promise.resolve({
        path: 'merchant-1/blog/hero.png',
        url: 'https://cdn.usebaci.com/hero.png',
      }).then((uploadedImage) => {
        webViewRef.current = null;
        return uploadedImage;
      })
    );

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.deleteBlogEditorImage).toHaveBeenCalledWith({
      accessToken: 'token',
      apiUrl: '',
      path: 'merchant-1/blog/hero.png',
    });
    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Editor unavailable',
      'Please wait for the editor to finish loading.'
    );
  });

  it('uploads and inserts the image when the editor remains mounted', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.injectJavaScript).toHaveBeenCalledWith(
      expect.stringContaining('https://cdn.usebaci.com/hero.png')
    );
    expect(mocks.deleteBlogEditorImage).not.toHaveBeenCalled();
  });

  it('continues gracefully when cleanup deletion fails', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;
    mocks.uploadBlogEditorImageDetails.mockImplementationOnce(() =>
      Promise.resolve({
        path: 'merchant-1/blog/hero.png',
        url: 'https://cdn.usebaci.com/hero.png',
      }).then((uploadedImage) => {
        webViewRef.current = null;
        return uploadedImage;
      })
    );
    mocks.deleteBlogEditorImage.mockRejectedValueOnce(
      new Error('Cleanup failed')
    );

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Editor unavailable',
      'Please wait for the editor to finish loading.'
    );
  });

  it('surfaces permission denial without attempting upload', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;
    mocks.requestMediaLibraryPermissionsAsync.mockResolvedValueOnce({
      granted: false,
    });

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.alert).toHaveBeenCalledWith(
      'Permission Required',
      'Please allow access to your photos'
    );
    expect(mocks.uploadBlogEditorImageDetails).not.toHaveBeenCalled();
  });

  it('stops quietly when the picker is cancelled', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;
    mocks.launchImageLibraryAsync.mockResolvedValueOnce({
      canceled: true,
    });

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.uploadBlogEditorImageDetails).not.toHaveBeenCalled();
    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
  });

  it('ignores malformed picker assets without uploading', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;
    mocks.launchImageLibraryAsync.mockResolvedValueOnce({
      assets: [{ uri: undefined }],
      canceled: false,
    });

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.uploadBlogEditorImageDetails).not.toHaveBeenCalled();
    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
  });

  it('shows an error when the session cannot be loaded', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;
    mocks.getSession.mockResolvedValueOnce({
      data: { session: null },
      error: new Error('Missing session'),
    });

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.uploadBlogEditorImageDetails).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith(
      'Upload Failed',
      'Missing session'
    );
  });

  it('shows an error when the upload fails', async () => {
    const webViewRef = {
      current: {
        injectJavaScript: (...args: unknown[]) =>
          mocks.injectJavaScript(...args),
      },
    } as unknown as RefObject<WebView | null>;
    mocks.uploadBlogEditorImageDetails.mockRejectedValueOnce(
      new Error('Upload failed')
    );

    const { result } = renderHook(() => useBlogImageUpload({ webViewRef }));

    await act(async () => {
      await result.current.handleImagePick();
    });

    expect(mocks.deleteBlogEditorImage).not.toHaveBeenCalled();
    expect(mocks.injectJavaScript).not.toHaveBeenCalled();
    expect(mocks.alert).toHaveBeenCalledWith('Upload Failed', 'Upload failed');
  });
});
