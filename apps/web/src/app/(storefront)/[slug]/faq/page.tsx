import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateFAQSchema } from '@/lib/seo-utils';
import { getTemplate } from '@/templates/registry';
import { type FAQItem, parseLegacyFAQ } from '@/types/faq';
import { FAQPageClient } from '../pages/faq/faq-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return { title: 'FAQ' };
  }

  return {
    title: `FAQ | ${merchant.business_name}`,
    description: `Frequently asked questions about ${merchant.business_name}.`,
    openGraph: {
      title: `FAQ | ${merchant.business_name}`,
      description: `Find answers to common questions about ${merchant.business_name}.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: '/faq',
    },
  };
}

/**
 * Synchronous page wrapper ensures the H1 tag appears in the initial SSR HTML,
 * rather than being deferred to RSC streaming (which crawlers like Ahrefs miss).
 */
export default function FAQPage({ params }: PageProps) {
  return (
    <>
      <h1 className="sr-only">Frequently Asked Questions</h1>
      <Suspense
        fallback={
          <div className="container mx-auto px-4 py-12 flex items-center justify-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <span className="sr-only">Loading FAQ...</span>
          </div>
        }
      >
        <FAQContent params={params} />
      </Suspense>
    </>
  );
}

async function FAQContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  let faqItems: FAQItem[] = [];

  if (
    merchant.faq_items &&
    Array.isArray(merchant.faq_items) &&
    merchant.faq_items.length > 0
  ) {
    faqItems = merchant.faq_items as FAQItem[];
  } else if (merchant.pages?.faq) {
    faqItems = parseLegacyFAQ(merchant.pages.faq);
  }

  if (faqItems.length === 0) {
    notFound();
  }

  const faqSchema = generateFAQSchema(faqItems);

  const jsonLdScript = (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
    />
  );

  // Resolve template component server-side for SEO (H1 in SSR HTML)
  const templateId = merchant.template_id;
  if (templateId && templateId !== 'default' && templateId !== 'puck') {
    const template = getTemplate(templateId);
    if (template) {
      try {
        const components = await template.getComponents();
        if (components.Help) {
          const HelpComponent = components.Help;
          return (
            <>
              {jsonLdScript}
              <HelpComponent
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
          'Failed to load Help component for template',
          templateId,
          ':',
          error
        );
      }
    }
  }

  // Fallback to default FAQ page
  return (
    <>
      {jsonLdScript}
      <FAQPageClient
        merchant={merchant}
        faqItems={faqItems}
        legacyContent={!merchant.faq_items ? merchant.pages?.faq : undefined}
      />
    </>
  );
}
