import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function robots({
  params,
}: Props): Promise<MetadataRoute.Robots> {
  const { slug } = await params;
  const headersList = await headers();
  const hostHeader = headersList.get('host');

  // Validate host to prevent header injection
  // In production, this should match *.baci.tech or configured custom domains
  const isValidHost =
    hostHeader &&
    (hostHeader.endsWith('.baci.tech') ||
      hostHeader.endsWith('.localhost:3000') ||
      hostHeader === 'localhost:3000');

  const host = isValidHost ? hostHeader : `${slug}.baci.tech`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const storeUrl = `${protocol}://${host}`;

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/checkout/', '/api/'],
    },
    sitemap: `${storeUrl}/sitemap.xml`,
  };
}
