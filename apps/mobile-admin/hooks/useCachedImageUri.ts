/**
 * useCachedImageUri Hook
 *
 * Downloads remote images (e.g. Supabase Storage URLs) to the local
 * file-system cache so React Native's <Image> component can render
 * them reliably. Data URIs and local file:// paths are returned as-is.
 *
 * Uses expo-file-system's new File/Paths API for network I/O and caching.
 */

import * as Crypto from 'expo-crypto';
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

async function downloadToCache(remoteUri: string): Promise<string> {
  try {
    // Deterministic cache key over the full URL; preserving the extension keeps
    // React Native image decoders on the fast path while avoiding URL-tail
    // collisions.
    const urlHash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      remoteUri
    );
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
