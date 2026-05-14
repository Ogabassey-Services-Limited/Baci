import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';
import { env } from '@/env';
import { extractManagedBlogStoragePath } from '@/lib/blog-managed-storage-paths';

const trustedOriginCandidates = [
  env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN || DEFAULT_BLOG_MEDIA_CDN_ORIGIN,
  env.NEXT_PUBLIC_SUPABASE_URL,
];

const TRUSTED_OG_IMAGE_ORIGINS = new Set(
  trustedOriginCandidates.flatMap((value) => {
    if (!value) return [];
    try {
      return [new URL(value).origin];
    } catch {
      return [];
    }
  })
);

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label: string
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`${label} timed out`)),
      timeoutMs
    );
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function getBlogCacheTag(
  routeIdentifier: string,
  postSlug: string
): string {
  return `blog-${routeIdentifier.trim().toLowerCase()}-${postSlug
    .trim()
    .toLowerCase()}`;
}

export function isAllowedBlogOgImageUrl(
  raw: string,
  merchantId: string
): boolean {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return false;
    if (!TRUSTED_OG_IMAGE_ORIGINS.has(url.origin)) return false;
    return extractManagedBlogStoragePath(raw, merchantId) !== null;
  } catch {
    return false;
  }
}

export function isAllowedLogoUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    return (
      url.protocol === 'https:' && TRUSTED_OG_IMAGE_ORIGINS.has(url.origin)
    );
  } catch {
    return false;
  }
}
