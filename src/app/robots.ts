import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const storeUrl = process.env.NEXT_PUBLIC_ROOT_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_ROOT_DOMAIN}`
    : 'http://localhost:3000';
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard/',
        '/onboarding/',
        '/_storefront/',
        '/api/',
        '/checkout/',
        '/reset-password/',
        '/auth/',
      ],
    },
    sitemap: `${storeUrl}/sitemap.xml`,
  };
}
