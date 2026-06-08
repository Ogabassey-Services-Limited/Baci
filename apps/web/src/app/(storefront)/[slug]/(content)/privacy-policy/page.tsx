import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { permanentRedirect } from 'next/navigation';
import { buildStorefrontRedirect } from '@/lib/build-storefront-redirect';

export const metadata: Metadata = {
  title: 'Privacy Policy Redirect',
  description:
    'Redirects legacy privacy policy URLs to the canonical storefront privacy page.',
};

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function LegacyPrivacyPolicyPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;
  permanentRedirect(
    buildStorefrontRedirect(
      await headers(),
      slug,
      '/privacy',
      await searchParams
    )
  );
}
