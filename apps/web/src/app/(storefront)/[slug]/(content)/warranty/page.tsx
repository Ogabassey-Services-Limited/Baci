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
import {
  buildMerchantTrustProfile,
  hasPublishableWarrantyPolicy,
} from '@/lib/storefront-trust/build-merchant-trust-profile';

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
    return { title: 'Warranty Policy' };
  }

  if (!hasPublishableWarrantyPolicy(context.trustProfile)) {
    notFound();
  }

  const warrantyPolicy = context.trustProfile.warrantyPolicy;

  if (!warrantyPolicy) {
    notFound();
  }

  const canonicalUrl = `${context.baseUrl}/warranty`;
  const description = generateMetaDescription(
    warrantyPolicy.summary
      ? `${warrantyPolicy.summary} Warranty policy for ${context.merchant.business_name}.`
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

export default function WarrantyPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={<ContentRouteLoading />}>
        <WarrantyPageContent params={params} />
      </Suspense>
      <StorefrontDynamicMetadataMarker />
    </>
  );
}

export async function WarrantyPageContent({ params }: PageProps) {
  const { slug } = await params;
  const context = await getTrustRouteContext(slug, { requestScopedUrl: true });

  if (!context) {
    notFound();
  }

  if (!hasPublishableWarrantyPolicy(context.trustProfile)) {
    notFound();
  }

  const warrantyPolicy = context.trustProfile.warrantyPolicy;

  if (!warrantyPolicy) {
    notFound();
  }

  const canonicalUrl = `${context.baseUrl}/warranty`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Warranty Policy | ${context.merchant.business_name}`,
    url: canonicalUrl,
    description:
      warrantyPolicy.summary ||
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
