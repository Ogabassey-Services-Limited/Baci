import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateMetaDescription,
  getIndexableRobotsMetadata,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
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
    return {
      title: 'Privacy Policy',
    };
  }

  const canonicalUrl = `${buildRequestScopedStoreUrl(merchant, await headers())}/privacy-policy`;
  const description = generateMetaDescription(
    `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`
  );

  return {
    title: `Privacy Policy | ${merchant.business_name}`,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Privacy Policy | ${merchant.business_name}`,
      description,
      type: 'website',
      url: canonicalUrl,
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    robots: getIndexableRobotsMetadata(),
  };
}

/** Streams JSON-LD separately while the visible page content loads. */
export default function PrivacyPolicyPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <PrivacyPolicyJsonLd params={params} />
      </Suspense>
      <Suspense
        fallback={
          <div className="container max-w-4xl mx-auto py-12 px-4 animate-pulse">
            <div className="h-10 w-64 bg-muted rounded mb-8" />
            <div className="space-y-4">
              {['s1', 's2', 's3', 's4', 's5', 's6'].map((id) => (
                <div key={id} className="h-4 bg-muted rounded w-full" />
              ))}
            </div>
          </div>
        }
      >
        <PrivacyPolicyContent params={params} />
      </Suspense>
    </>
  );
}

/** Streams JSON-LD structured data independently of page content. */
async function PrivacyPolicyJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

  const hasPrivacyContent = merchant.pages?.privacy;
  const templateHasPrivacyPage = merchant.template_id === 'ogabassey';
  if (!hasPrivacyContent && !templateHasPrivacyPage) return null;

  const baseUrl = buildRequestScopedStoreUrl(merchant, await headers());

  const privacySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Privacy Policy | ${merchant.business_name}`,
    url: `${baseUrl}/privacy-policy`,
    description: `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`,
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
    ...(merchant.updated_at ? { dateModified: merchant.updated_at } : {}),
  };

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(privacySchema) }}
    />
  );
}

async function PrivacyPolicyContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const merchantPages = merchant.pages;
  const hasPrivacyContent = merchantPages?.privacy;
  const templateHasPrivacyPage = merchant.template_id === 'ogabassey';

  if (!hasPrivacyContent && !templateHasPrivacyPage) {
    notFound();
  }

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Privacy) {
          const PrivacyComponent = components.Privacy;
          return (
            <PrivacyComponent
              // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
              merchant={merchant as any}
              storeSlug={merchant.slug}
              isPreview={false}
            />
          );
        }
      } catch (error) {
        console.error(
          'Failed to load Privacy component for template',
          templateId,
          ':',
          error
        );
      }
    }
  }

  return (
    <PrivacyPageClient merchant={merchant} content={merchantPages?.privacy} />
  );
}
