export type StorefrontPublicCachePolicy = {
  readonly slug: string;
  readonly customHostnames: readonly string[];
  readonly cacheableCategorySegments: readonly string[];
};

export const STOREFRONT_PUBLIC_CACHE_POLICIES = [
  {
    slug: 'ogabassey',
    customHostnames: ['ogabassey.com', 'www.ogabassey.com'],
    cacheableCategorySegments: [
      'accessories',
      'gaming',
      'gaming-consoles',
      'gift-cards',
      'laptops',
      'nintendo-switch',
      'smartphones',
      'smartwatches',
      'tablets',
    ],
  },
] as const satisfies readonly StorefrontPublicCachePolicy[];

export const STOREFRONT_CACHE = {
  productsSMaxAge: 300,
  productsStaleWhileRevalidate: 3600,
} as const;
