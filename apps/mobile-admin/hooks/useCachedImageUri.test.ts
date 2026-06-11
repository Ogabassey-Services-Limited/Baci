import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useCachedImageUri } from './useCachedImageUri';

// Mock variables that can be accessed inside vi.mock using vi.hoisted
const { mocks } = vi.hoisted(() => {
  const mockDownloadFileAsync = vi.fn();
  const mockDigestStringAsync = vi.fn(
    async (_algorithm: string, value: string) => `sha256_${value.length}`
  );
  const mockFileExists = vi.fn().mockReturnValue(false);

  class MockURL {
    constructor(private href: string) {}
    toString() {
      return this.href;
    }
  }

  class MockFile {
    exists = false;
    uri: MockURL;
    constructor(_parent: unknown, name: string) {
      this.exists = mockFileExists();
      this.uri = new MockURL(`file:///cache/${name}`);
    }
  }

  return {
    mocks: {
      mockDownloadFileAsync,
      mockDigestStringAsync,
      mockFileExists,
      MockURL,
      MockFile,
    },
  };
});

vi.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: {
    SHA256: 'SHA-256',
  },
  digestStringAsync: mocks.mockDigestStringAsync,
}));

vi.mock('expo-file-system', () => {
  return {
    Paths: {
      cache: 'mock-cache-dir',
    },
    File: class extends mocks.MockFile {
      static downloadFileAsync = mocks.mockDownloadFileAsync;
    },
  };
});

describe('useCachedImageUri', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockDigestStringAsync.mockImplementation(
      async (_algorithm: string, value: string) => `sha256_${value.length}`
    );
    mocks.mockFileExists.mockReturnValue(false);
  });

  it('returns null if remoteUri is falsy', () => {
    const { result } = renderHook(() => useCachedImageUri(null));
    expect(result.current.uri).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('returns the same remoteUri immediately for local or data URIs', () => {
    const localPath = 'file:///local/path.png';
    const { result } = renderHook(() => useCachedImageUri(localPath));
    expect(result.current.uri).toBe(localPath);
    expect(result.current.isLoading).toBe(false);
  });

  it('returns stringified cached URI if the file is already cached', async () => {
    mocks.mockFileExists.mockReturnValue(true);
    const remoteUri = 'https://example.com/image.png';

    const { result } = renderHook(() => useCachedImageUri(remoteUri));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.uri).toBe('string');
    expect(result.current.uri).toBe('file:///cache/img_cache_sha256_29.png');
    expect(mocks.mockDigestStringAsync).toHaveBeenCalledWith(
      'SHA-256',
      remoteUri
    );
    expect(mocks.mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  it('downloads file and returns stringified downloaded URI if not cached', async () => {
    mocks.mockFileExists.mockReturnValue(false);
    const remoteUri = 'https://example.com/image2.png';

    mocks.mockDownloadFileAsync.mockResolvedValue({
      uri: new mocks.MockURL('file:///cache/downloaded_image2.png'),
    });

    const { result } = renderHook(() => useCachedImageUri(remoteUri));

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(typeof result.current.uri).toBe('string');
    expect(result.current.uri).toBe('file:///cache/downloaded_image2.png');
    expect(mocks.mockDownloadFileAsync).toHaveBeenCalled();
  });

  it('falls back to remoteUri string if download throws', async () => {
    mocks.mockFileExists.mockReturnValue(false);
    const remoteUri = 'https://example.com/image3.png';
    mocks.mockDownloadFileAsync.mockRejectedValue(new Error('Download failed'));

    const { result } = renderHook(() => useCachedImageUri(remoteUri));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.uri).toBe(remoteUri);
  });
});
