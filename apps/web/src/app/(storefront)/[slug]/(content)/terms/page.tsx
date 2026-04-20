import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { getTemplate } from '@/templates/registry';
import { TermsPageClient } from '../pages/terms/terms-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return { title: 'Terms of Service' };
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());
  const canonicalUrl = `${baseUrl}/terms`;
  const description = generateMetaDescription(
    `Terms of Service for ${merchant.business_name}. Read our terms and conditions.`
  );

  return {
    title: `Terms of Service | ${merchant.business_name}`,
    description,
    openGraph: {
      title: `Terms of Service | ${merchant.business_name}`,
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

export default async function TermsPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const hasTermsContent = merchant.pages?.terms;
  const templateHasTermsPage =
    !!merchant.template_id &&
    merchant.template_id !== 'default' &&
    merchant.template_id !== 'puck';

  if (!hasTermsContent && !templateHasTermsPage) {
    notFound();
  }

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());

  const termsSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Terms of Service | ${merchant.business_name}`,
    url: `${baseUrl}/terms`,
    description: `Terms of Service for ${merchant.business_name}.`,
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
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(termsSchema) }}
    />
  );

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  if (templateHasTermsPage) {
    const template = getTemplate(merchant.template_id);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Terms) {
          const TermsComponent = components.Terms;
          return (
            <>
              {jsonLdScript}
              <TermsComponent
                // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
                merchant={merchant as any}
                storeSlug={merchant.slug}
                isPreview={false}
              />
            </>
          );
        }
      } catch (error) {
        console.error(
          'Failed to load Terms component for template',
          merchant.template_id,
          ':',
          error
        );
      }
    }
  }

  // Fallback to default terms page
  return (
    <>
      {jsonLdScript}
      <TermsPageClient merchant={merchant} content={merchant.pages?.terms} />
    </>
  );
}
