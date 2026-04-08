import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { getTemplate } from '@/templates/registry';
import { PrivacyPageClient } from '../pages/privacy/privacy-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Normalize domain by stripping protocol and trailing slashes.
 * Defense-in-depth: guards against malformed data in database.
 */
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase();
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

  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const normalizedDomain = normalizeDomain(merchant.custom_domain);
  const host = normalizedDomain || `${slug}.usebaci.com`;
  const canonicalUrl = `${protocol}://${host}/privacy-policy`;

  return {
    title: `Privacy Policy | ${merchant.business_name}`,
    description: `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title: `Privacy Policy | ${merchant.business_name}`,
      description: `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`,
      type: 'website',
      url: canonicalUrl,
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
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

  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const normalizedDomain = normalizeDomain(merchant.custom_domain);
  const baseUrl = normalizedDomain
    ? `${protocol}://${normalizedDomain}`
    : `${protocol}://${slug}.usebaci.com`;

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
