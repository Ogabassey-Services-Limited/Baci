import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

export const metadata: Metadata = {
  title: 'Contact Redirect',
  description:
    'Redirects legacy contact page URLs to the canonical storefront contact page.',
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyContactPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  permanentRedirect(
    buildStorefrontRedirect(
      await headers(),
      slug,
      '/contact',
      await searchParams
    )
  );
}
