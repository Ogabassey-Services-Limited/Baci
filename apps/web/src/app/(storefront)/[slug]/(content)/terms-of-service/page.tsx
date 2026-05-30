import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { connection } from 'next/server';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export function generateMetadata(): Metadata {
  return { robots: { index: false, follow: false } };
}

export default async function LegacyTermsOfServicePage({
  params,
  searchParams,
}: PageProps) {
  await connection();
  const { slug } = await params;
  permanentRedirect(
    buildStorefrontRedirect(await headers(), slug, '/terms', await searchParams)
  );
}
