export const PLATFORM_REQUIRED_LOCATIONS = [
  '/',
  '/pricing',
  '/features',
  '/blog',
] as const;

export const PLATFORM_EXCLUDED_LOCATIONS = ['/login', '/onboarding'] as const;

export const MERCHANT_REQUIRED_SITEMAPS = [
  '/sitemap/static.xml',
  '/sitemap/products.xml',
  '/sitemap/categories.xml',
  '/blog/sitemap.xml',
] as const;
