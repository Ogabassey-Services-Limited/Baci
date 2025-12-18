import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost:3000';
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const storeUrl = `${protocol}://${host}`;

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
