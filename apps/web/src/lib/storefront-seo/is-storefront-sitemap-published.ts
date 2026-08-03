/** Returns whether a merchant may expose any public sitemap URLs. */
export function isStorefrontSitemapPublished(merchant: {
  is_published?: boolean | null;
}): boolean {
  return merchant.is_published === true;
}
