import { DEFAULT_MEDIA_CDN_ORIGIN } from '@/config/cdn';

const SUPABASE_PUBLIC_MEDIA_MARKER = '/storage/v1/object/public/media/';
const CDN_PUBLIC_MEDIA_MARKER = '/media/';
const SUPABASE_HOST_SUFFIX = '.supabase.co';
const DEFAULT_MEDIA_CDN_HOSTNAME = new URL(DEFAULT_MEDIA_CDN_ORIGIN).hostname;

function getConfiguredMediaCdnOrigin(origin?: string): string {
  if (!origin) {
    return DEFAULT_MEDIA_CDN_ORIGIN;
  }

  try {
    return new URL(origin).origin;
  } catch {
    return DEFAULT_MEDIA_CDN_ORIGIN;
  }
}

function hasRawDotPathSegment(value: string): boolean {
  const rawPath = value.split(/[?#]/, 1)[0] ?? value;
  let decodedPath = rawPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return true;
  }

  return /(^|\/)\.{1,2}(\/|$)/.test(decodedPath);
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code < 32 || code === 127) {
      return true;
    }
  }

  return false;
}

function isKnownSupabaseStorageHost(hostname: string): boolean {
  return hostname.endsWith(SUPABASE_HOST_SUFFIX);
}

function isConfiguredMediaCdnHost(hostname: string): boolean {
  return hostname === DEFAULT_MEDIA_CDN_HOSTNAME;
}

export function isSafeStorefrontMediaStoragePath(path: string): boolean {
  const normalized = path.trim();
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.includes('//') ||
    hasControlCharacter(normalized)
  ) {
    return false;
  }

  return normalized
    .split('/')
    .every((segment) => segment && segment !== '.' && segment !== '..');
}

export function extractStorefrontMediaStoragePath(
  publicUrl: string
): string | null {
  try {
    if (hasRawDotPathSegment(publicUrl)) {
      return null;
    }

    const parsed = new URL(publicUrl);
    const pathname = decodeURIComponent(parsed.pathname);
    let storagePath = '';
    if (pathname.startsWith(SUPABASE_PUBLIC_MEDIA_MARKER)) {
      if (!isKnownSupabaseStorageHost(parsed.hostname)) {
        return null;
      }
      storagePath = pathname.slice(SUPABASE_PUBLIC_MEDIA_MARKER.length);
    } else if (pathname.startsWith(CDN_PUBLIC_MEDIA_MARKER)) {
      if (!isConfiguredMediaCdnHost(parsed.hostname)) {
        return null;
      }
      storagePath = pathname.slice(CDN_PUBLIC_MEDIA_MARKER.length);
    }

    const normalized = storagePath.replace(/^\/+/, '');
    return isSafeStorefrontMediaStoragePath(normalized) ? normalized : null;
  } catch {
    return null;
  }
}

export function buildStorefrontMediaCdnUrl(
  storagePath: string,
  origin?: string
): string | null {
  const normalized = storagePath.trim().replace(/^\/+/, '');
  if (!isSafeStorefrontMediaStoragePath(normalized)) {
    return null;
  }

  const encodedPath = normalized.split('/').map(encodeURIComponent).join('/');
  return `${getConfiguredMediaCdnOrigin(origin)}/media/${encodedPath}`;
}

export function canonicalizeStorefrontMediaUrl(
  publicUrlOrPath: string,
  origin?: string
): string | null {
  const input = publicUrlOrPath.trim();
  const storagePath = isSafeStorefrontMediaStoragePath(input)
    ? input
    : extractStorefrontMediaStoragePath(input);

  return storagePath ? buildStorefrontMediaCdnUrl(storagePath, origin) : null;
}
