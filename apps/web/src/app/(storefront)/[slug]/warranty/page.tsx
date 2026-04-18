import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { TrustPolicyPageClient } from '@/components/storefront/trust/trust-policy-page-client';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getTrustRouteContext(slug: string) {
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return null;
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);

  return { merchant, baseUrl, trustProfile };
}

function getContactHref(
  merchant: Awaited<ReturnType<typeof getRequestScopedMerchant>>,
  baseUrl: string
): string | undefined {
  return merchant.pages?.contact?.trim() ||
    merchant.email?.trim() ||
    merchant.phone?.trim()
    ? `${baseUrl}/contact`
    : undefined;
}

function hasPublishableWarrantyPolicy(
  trustProfile: Awaited<ReturnType<typeof buildMerchantTrustProfile>>
): boolean {
  return Boolean(trustProfile.warrantyPolicy?.summary?.trim());
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const context = await getTrustRouteContext(slug);

  if (!context) {
    return { title: 'Warranty Policy' };
  }

  if (!hasPublishableWarrantyPolicy(context.trustProfile)) {
    notFound();
  }

  const canonicalUrl = `${context.baseUrl}/warranty`;
  const description = generateMetaDescription(
    context.trustProfile.warrantyPolicy.summary
      ? `${context.trustProfile.warrantyPolicy.summary} Warranty policy for ${context.merchant.business_name}.`
      : `Warranty policy for ${context.merchant.business_name}.`
  );

  return {
    title: `Warranty Policy | ${context.merchant.business_name}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Warranty Policy | ${context.merchant.business_name}`,
      description,
      type: 'website',
      url: canonicalUrl,
      ...(context.merchant.logo_url && {
        images: [{ url: context.merchant.logo_url }],
      }),
    },
    robots: getIndexableRobotsMetadata(),
  };
}

export default async function WarrantyPage({ params }: PageProps) {
  const { slug } = await params;
  const context = await getTrustRouteContext(slug);

  if (!context) {
    notFound();
  }

  if (!hasPublishableWarrantyPolicy(context.trustProfile)) {
    notFound();
  }

  const canonicalUrl = `${context.baseUrl}/warranty`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Warranty Policy | ${context.merchant.business_name}`,
    url: canonicalUrl,
    description:
      context.trustProfile.warrantyPolicy.summary ||
      `Warranty policy for ${context.merchant.business_name}.`,
    isPartOf: {
      '@type': 'WebSite',
      name: context.merchant.business_name,
      url: context.baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: context.merchant.business_name,
      url: context.baseUrl,
      ...(context.merchant.logo_url && { logo: context.merchant.logo_url }),
    },
    inLanguage: 'en',
    ...(context.merchant.updated_at
      ? { dateModified: context.merchant.updated_at }
      : {}),
  };

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(jsonLd) }}
      />
      <TrustPolicyPageClient
        kind="warranty"
        merchantName={context.merchant.business_name}
        contactHref={getContactHref(context.merchant, context.baseUrl)}
        trustProfile={context.trustProfile}
      />
    </>
  );
}
