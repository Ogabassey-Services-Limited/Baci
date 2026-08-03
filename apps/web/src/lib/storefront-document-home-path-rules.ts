export type StorefrontDocumentHomePathRules = {
  isSlugPrefixedHost: (hostname: string) => boolean;
  extractMerchantSubdomain: (hostname: string) => string | null;
  extractLocalhostSubdomain: (hostname: string) => string | null;
  isValidCustomDomain: (hostname: string) => boolean;
  isValidMerchantSlug: (slug: string) => boolean;
  reservedSubdomains: ReadonlySet<string>;
  platformRootRouteSegments: ReadonlySet<string>;
};
