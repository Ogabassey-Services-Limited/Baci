import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

// Intentional page-level metadata for this redirect-only legacy route: keep it noindex so crawlers do not treat the transitional URL as canonical.
export const metadata: Metadata = {
  title: 'Blog Redirect',
  description:
    'Redirects legacy blog page URLs to the canonical storefront blog page.',
  robots: { index: false, follow: true },
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyBlogPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  permanentRedirect(
    buildStorefrontRedirect(await headers(), slug, '/blog', await searchParams)
  );
}
