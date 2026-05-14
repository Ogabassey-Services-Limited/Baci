export function getBlogCacheTag(
  routeIdentifier: string,
  postSlug: string
): string {
  return `blog-${routeIdentifier.trim().toLowerCase()}-${postSlug
    .trim()
    .toLowerCase()}`;
}
