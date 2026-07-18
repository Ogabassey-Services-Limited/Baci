/**
 * useCachedImageUri Hook
 *
 * Builds target-sized Supabase Storage URLs and delegates downloading,
 * caching, and bitmap memory management to React Native's native image
 * pipeline. Data URIs and local file:// paths are returned as-is.
 */

interface CachedImageResult {
  /** The URI to pass to Image source. */
  uri: string | null;
  /** Kept for call-site compatibility; native image loading owns progress. */
  isLoading: boolean;
}

interface ImageOptimizationOptions {
  width: number;
  height: number;
  resize: 'contain' | 'cover' | 'fill';
}

const PUBLIC_OBJECT_PATH = '/storage/v1/object/public/';
const PUBLIC_RENDER_PATH = '/storage/v1/render/image/public/';

function isRemoteHttpUri(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

function getConfiguredSupabaseOrigin(): string | null {
  const configuredUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

  try {
    return configuredUrl ? new URL(configuredUrl).origin : null;
  } catch {
    return null;
  }
}

function getTargetSizedUri(
  remoteUri: string,
  options?: ImageOptimizationOptions
): string {
  if (!options) return remoteUri;

  try {
    const url = new URL(remoteUri);
    const supabaseOrigin = getConfiguredSupabaseOrigin();
    if (
      !supabaseOrigin ||
      url.origin !== supabaseOrigin ||
      !url.pathname.startsWith(PUBLIC_OBJECT_PATH) ||
      url.pathname.toLowerCase().endsWith('.svg')
    ) {
      return remoteUri;
    }

    url.pathname = url.pathname.replace(PUBLIC_OBJECT_PATH, PUBLIC_RENDER_PATH);
    url.searchParams.set('width', String(options.width));
    url.searchParams.set('height', String(options.height));
    url.searchParams.set('resize', options.resize);
    return url.toString();
  } catch {
    return remoteUri;
  }
}

export function useCachedImageUri(
  remoteUri: string | null | undefined,
  options?: ImageOptimizationOptions
): CachedImageResult {
  if (!remoteUri) {
    return { uri: null, isLoading: false };
  }

  if (!isRemoteHttpUri(remoteUri)) {
    return { uri: remoteUri, isLoading: false };
  }

  return {
    uri: getTargetSizedUri(remoteUri, options),
    isLoading: false,
  };
}
