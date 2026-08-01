/**
 * Public runtime values that are safe to reference from browser-reachable blog
 * modules. Keep this module limited to literal NEXT_PUBLIC_* reads so it never
 * pulls server-only environment validation or secret accessors into a client
 * bundle.
 */
export function getPublicBlogMediaCdnOrigin(): string | undefined {
  return process.env.NEXT_PUBLIC_BLOG_MEDIA_CDN_ORIGIN;
}

export function getPublicRootDomain(): string | undefined {
  return process.env.NEXT_PUBLIC_ROOT_DOMAIN;
}
