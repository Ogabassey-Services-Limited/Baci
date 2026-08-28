import { DEFAULT_BLOG_MEDIA_CDN_ORIGIN } from '@/config/cdn';

const TRANSFORM_PATH_PATTERN = /^\/image\/[^/]+\/.+$/u;

/** Identifies transform-shaped URLs served by an approved blog media origin. */
export function isTrustedBlogMediaTransformUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const trustedOrigins = [
      process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN,
      DEFAULT_BLOG_MEDIA_CDN_ORIGIN,
    ].flatMap((value) => {
      if (!value) return [];
      try {
        return [new URL(value).origin];
      } catch {
        return [];
      }
    });

    return (
      url.protocol === 'https:' &&
      trustedOrigins.includes(url.origin) &&
      TRANSFORM_PATH_PATTERN.test(url.pathname)
    );
  } catch {
    return false;
  }
}
