import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontDynamicMetadataMarker } from '@/app/(storefront)/[slug]/storefront-dynamic-metadata-marker';
import { ContentRouteLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl, buildStoreUrl } from '@/lib/store-url';
import { getTemplate } from '@/templates/registry';
import { PrivacyPageClient } from '../pages/privacy/privacy-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return { title: 'Privacy Policy' };
  }

  const baseUrl = buildStoreUrl(merchant);
  const canonicalUrl = `${baseUrl}/privacy`;
  const description = generateMetaDescription(
    `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`
  );

  return {
    title: `Privacy Policy | ${merchant.business_name}`,
    description,
    openGraph: {
      title: `Privacy Policy | ${merchant.business_name}`,
      description,
      type: 'website',
      url: canonicalUrl,
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: canonicalUrl,
    },
    robots: getIndexableRobotsMetadata(),
  };
}

export default function PrivacyPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={<ContentRouteLoading />}>
        <PrivacyPageContent params={params} />
      </Suspense>
      <StorefrontDynamicMetadataMarker />
    </>
  );
}

async function PrivacyPageContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const hasPrivacyContent = merchant.pages?.privacy;
  const templateHasPrivacyPage =
    !!merchant.template_id &&
    merchant.template_id !== 'default' &&
    merchant.template_id !== 'puck';

  if (!hasPrivacyContent && !templateHasPrivacyPage) {
    notFound();
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());

  const privacySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Privacy Policy | ${merchant.business_name}`,
    url: `${baseUrl}/privacy`,
    description: `Privacy Policy for ${merchant.business_name}.`,
    isPartOf: {
      '@type': 'WebSite',
      name: merchant.business_name,
      url: baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: merchant.business_name,
      url: baseUrl,
      ...(merchant.logo_url && { logo: merchant.logo_url }),
    },
    inLanguage: 'en',
    dateModified: merchant.updated_at || new Date().toISOString(),
  };

  const jsonLdScript = (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(privacySchema) }}
    />
  );

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  if (templateHasPrivacyPage) {
    const template = getTemplate(merchant.template_id);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Privacy) {
          const PrivacyComponent = components.Privacy;
          return (
            <>
              {jsonLdScript}
              <PrivacyComponent
                merchant={toTemplateMerchantData(merchant)}
                storeSlug={merchant.slug}
                isPreview={false}
              />
            </>
          );
        }
      } catch (error) {
        console.error(
          'Failed to load Privacy component for template',
          merchant.template_id,
          ':',
          error
        );
      }
    }
  }

  // Fallback to default privacy page
  return (
    <>
      {jsonLdScript}
      <PrivacyPageClient
        merchant={merchant}
        content={merchant.pages?.privacy}
      />
    </>
  );
}
