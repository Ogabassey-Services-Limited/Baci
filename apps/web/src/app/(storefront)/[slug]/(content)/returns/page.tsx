import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { ContentRouteLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { TrustPolicyPageClient } from '@/components/storefront/trust/trust-policy-page-client';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl, buildStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getTrustRouteContext(
  slug: string,
  options: { requestScopedUrl?: boolean } = {}
) {
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    return null;
  }

  const baseUrl = options.requestScopedUrl
    ? buildRequestScopedStoreUrl(merchant, await headers())
    : buildStoreUrl(merchant);
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);

  return { merchant, baseUrl, trustProfile };
}

function getContactHref(
  merchant: NonNullable<Awaited<ReturnType<typeof getRequestScopedMerchant>>>,
  baseUrl: string
): string | undefined {
  return merchant.pages?.contact?.trim() ||
    merchant.email?.trim() ||
    merchant.phone?.trim()
    ? `${baseUrl}/contact`
    : undefined;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const context = await getTrustRouteContext(slug);

  if (!context) {
    return { title: 'Returns Policy' };
  }

  const returnPolicy = context.trustProfile.returnPolicy;

  const canonicalUrl = `${context.baseUrl}/returns`;
  const description = generateMetaDescription(
    returnPolicy?.summary
      ? `${returnPolicy.summary} Returns policy for ${context.merchant.business_name}.`
      : `Returns policy for ${context.merchant.business_name}.`
  );

  return {
    title: `Returns Policy | ${context.merchant.business_name}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Returns Policy | ${context.merchant.business_name}`,
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

export default function ReturnsPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <StorefrontDynamicMetadataMarker />
      </Suspense>
      <Suspense fallback={<ContentRouteLoading />}>
        <ReturnsPageContent params={params} />
      </Suspense>
    </>
  );
}

export async function ReturnsPageContent({ params }: PageProps) {
  const { slug } = await params;
  const context = await getTrustRouteContext(slug, { requestScopedUrl: true });

  if (!context) {
    notFound();
  }

  const returnPolicy = context.trustProfile.returnPolicy;

  const canonicalUrl = `${context.baseUrl}/returns`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Returns Policy | ${context.merchant.business_name}`,
    url: canonicalUrl,
    description:
      returnPolicy?.summary ||
      `Returns policy for ${context.merchant.business_name}.`,
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
        kind="returns"
        merchantName={context.merchant.business_name}
        contactHref={getContactHref(context.merchant, context.baseUrl)}
        trustProfile={context.trustProfile}
      />
    </>
  );
}
