import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontLocalPath } from '@/lib/build-storefront-local-path';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function LegacyTermsPage({ params }: PageProps) {
  const { slug } = await params;

  permanentRedirect(buildStorefrontLocalPath(await headers(), slug, '/terms'));
}
