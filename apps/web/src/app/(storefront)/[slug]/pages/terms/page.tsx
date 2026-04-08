import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { getTemplate } from '@/templates/registry';
import { TermsPageClient } from './terms-page-client';

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
      title: 'Terms of Service',
    };
  }

  return {
    title: `Terms of Service | ${merchant.business_name}`,
    description: `Terms of Service for ${merchant.business_name}. Read our terms and conditions for using our services.`,
    openGraph: {
      title: `Terms of Service | ${merchant.business_name}`,
      description: `Terms of Service for ${merchant.business_name}. Read our terms and conditions.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: '/terms',
    },
  };
}

/** Streams JSON-LD separately while the visible page content loads. */
export default function TermsPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <TermsJsonLd params={params} />
      </Suspense>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="sr-only">Loading terms of service...</span>
          </div>
        }
      >
        <TermsContent params={params} />
      </Suspense>
    </>
  );
}

/** Streams JSON-LD structured data independently of page content. */
async function TermsJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

  const hasTermsContent = merchant.pages?.terms;
  const templateHasTermsPage = merchant.template_id === 'ogabassey';
  if (!hasTermsContent && !templateHasTermsPage) return null;

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${merchant.slug}`
    : `https://${merchant.slug}.${rootDomain}`;

  const termsSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Terms of Service | ${merchant.business_name}`,
    url: `${baseUrl}/pages/terms`,
    description: `Terms of Service for ${merchant.business_name}. Read our terms and conditions for using our services.`,
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

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(termsSchema) }}
    />
  );
}

async function TermsContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  const hasTermsContent = merchant.pages?.terms;
  const templateHasTermsPage = merchant.template_id === 'ogabassey';

  if (!hasTermsContent && !templateHasTermsPage) {
    notFound();
  }

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Terms) {
          const TermsComponent = components.Terms;
          return (
            <TermsComponent
              // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
              merchant={merchant as any}
              storeSlug={merchant.slug}
              isPreview={false}
            />
          );
        }
      } catch (error) {
        console.error(
          'Failed to load Terms component for template',
          templateId,
          ':',
          error
        );
      }
    }
  }

  return (
    <TermsPageClient merchant={merchant} content={merchant.pages?.terms} />
  );
}
