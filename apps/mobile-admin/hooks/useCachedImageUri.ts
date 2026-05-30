/**
 * useCachedImageUri Hook
 *
 * Downloads remote images (e.g. Supabase Storage URLs) to the local
 * file-system cache so React Native's <Image> component can render
 * them reliably. Data URIs and local file:// paths are returned as-is.
 *
 * Uses expo-file-system's new File/Paths API for network I/O and caching.
 */

import { File, Paths } from 'expo-file-system';
import { useEffect, useState } from 'react';

interface CachedImageResult {
  /** The URI to pass to Image source — either the original or a cached local path */
  uri: string | null;
  /** Whether the download is still in progress */
  isLoading: boolean;
}

export function useCachedImageUri(
  remoteUri: string | null | undefined
): CachedImageResult {
  const [localUri, setLocalUri] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!remoteUri) {
      setLocalUri(null);
      return;
    }

    // Data URIs and local file paths don't need caching
    if (!remoteUri.startsWith('https://') && !remoteUri.startsWith('http://')) {
      setLocalUri(remoteUri);
      return;
    }

    let cancelled = false;

    const download = async () => {
      setIsLoading(true);
      try {
        // Build a deterministic cache key from the URL and preserve extension
        const urlHash = remoteUri.replace(/[^a-zA-Z0-9]/g, '_').slice(-80);
        const urlParts = remoteUri.split('?')[0].split('.');
        const ext = urlParts.length > 1 ? `.${urlParts.pop()}` : '';
        const dest = new File(Paths.cache, `img_cache_${urlHash}${ext}`);

        // Check if already cached
        if (dest.exists && !cancelled) {
          const cachedUri =
            typeof dest.uri === 'string' ? dest.uri : String(dest.uri);
          setLocalUri(cachedUri);
          setIsLoading(false);
          return;
        }

        // Download to local cache
        const downloaded = await File.downloadFileAsync(remoteUri, dest, {
          idempotent: true,
        });
        if (!cancelled) {
          const downloadedUri =
            typeof downloaded.uri === 'string'
              ? downloaded.uri
              : String(downloaded.uri);
          setLocalUri(downloadedUri);
        }
      } catch {
        // Network error — fall back to the original URL so SafeImage
        // can show its normal fallback icon if that also fails
        if (!cancelled) {
          setLocalUri(remoteUri);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    download();
    return () => {
      cancelled = true;
    };
  }, [remoteUri]);

  return { uri: localUri, isLoading };
}
