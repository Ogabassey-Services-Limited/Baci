import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyFaqPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  permanentRedirect(
    buildStorefrontRedirect(await headers(), slug, '/faq', await searchParams)
  );
}
