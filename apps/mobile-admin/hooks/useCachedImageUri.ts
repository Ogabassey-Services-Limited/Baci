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

function isRemoteHttpUri(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

// djb2 over the full URL: a readable tail alone can collide when different
// hosts serve identically-named files.
function hashUri(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index++) {
    hash = ((hash << 5) + hash + value.charCodeAt(index)) | 0;
  }
  return (hash >>> 0).toString(36);
}

async function downloadToCache(remoteUri: string): Promise<string> {
  try {
    // Deterministic cache key: full-URL hash + length + readable tail,
    // preserving the extension
    const readableTail = remoteUri.replace(/[^a-zA-Z0-9]/g, '_').slice(-40);
    const urlHash = `${hashUri(remoteUri)}_${remoteUri.length}_${readableTail}`;
    const urlParts = remoteUri.split('?')[0].split('.');
    const ext = urlParts.length > 1 ? `.${urlParts.pop()}` : '';
    const dest = new File(Paths.cache, `img_cache_${urlHash}${ext}`);

    // Check if already cached
    if (dest.exists) {
      return typeof dest.uri === 'string' ? dest.uri : String(dest.uri);
    }

    // Download to local cache
    const downloaded = await File.downloadFileAsync(remoteUri, dest, {
      idempotent: true,
    });
    return typeof downloaded.uri === 'string'
      ? downloaded.uri
      : String(downloaded.uri);
  } catch {
    // Network error — fall back to the original URL so SafeImage
    // can show its normal fallback icon if that also fails
    return remoteUri;
  }
}

export function useCachedImageUri(
  remoteUri: string | null | undefined
): CachedImageResult {
  const [resolved, setResolved] = useState<{
    key: string;
    uri: string;
  } | null>(null);

  useEffect(() => {
    if (!remoteUri || !isRemoteHttpUri(remoteUri)) {
      return;
    }

    let cancelled = false;

    void downloadToCache(remoteUri).then((uri) => {
      if (!cancelled) {
        setResolved({ key: remoteUri, uri });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [remoteUri]);

  if (!remoteUri) {
    return { uri: null, isLoading: false };
  }

  // Data URIs and local file paths don't need caching
  if (!isRemoteHttpUri(remoteUri)) {
    return { uri: remoteUri, isLoading: false };
  }

  const settled = resolved?.key === remoteUri ? resolved : null;
  return { uri: settled?.uri ?? null, isLoading: settled === null };
}
