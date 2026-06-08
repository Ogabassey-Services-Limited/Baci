import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function LegacyTermsAndConditionsPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  permanentRedirect(
    buildStorefrontRedirect(await headers(), slug, '/terms', await searchParams)
  );
}
