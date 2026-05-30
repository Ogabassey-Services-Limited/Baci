import type { Metadata } from 'next';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { ContentRouteLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { getTrustRouteContext } from '../trust-route-context';
import { ShippingPageContent } from './shipping-page-content';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  await connection();
  const { slug } = await params;
  const context = await getTrustRouteContext(slug);

  if (!context) {
    return { title: 'Shipping Policy' };
  }

  const shippingPolicy = context.trustProfile.shippingPolicy;

  const canonicalUrl = `${context.baseUrl}/shipping`;
  const description = generateMetaDescription(
    shippingPolicy?.summary
      ? `${shippingPolicy.summary} Shipping policy for ${context.merchant.business_name}.`
      : `Shipping policy for ${context.merchant.business_name}.`
  );

  return {
    title: `Shipping Policy | ${context.merchant.business_name}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Shipping Policy | ${context.merchant.business_name}`,
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

export default function ShippingPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={<ContentRouteLoading />}>
        <ShippingPageContent params={params} />
      </Suspense>
      <StorefrontDynamicMetadataMarker />
    </>
  );
}
