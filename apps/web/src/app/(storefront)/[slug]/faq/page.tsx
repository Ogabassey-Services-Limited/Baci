import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import {
  getMerchantByIdentifier,
  getRequestScopedMerchant,
} from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateFAQSchema, getIndexableRobotsMetadata } from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { getTemplate } from '@/templates/registry';
import { type FAQItem, parseLegacyFAQ } from '@/types/faq';
import { FAQPageClient } from '../pages/faq/faq-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Extracts FAQ items from merchant data, checking both structured faq_items
 * and legacy FAQ content. Returns an empty array when no valid items exist.
 */
function extractFaqItems(merchant: {
  faq_items?: unknown;
  pages?: { faq?: string };
}): FAQItem[] {
  if (
    merchant.faq_items &&
    Array.isArray(merchant.faq_items) &&
    merchant.faq_items.length > 0
  ) {
    return merchant.faq_items as FAQItem[];
  }
  if (merchant.pages?.faq) {
    return parseLegacyFAQ(merchant.pages.faq);
  }
  return [];
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  if (extractFaqItems(merchant).length === 0) {
    notFound();
  }

  const canonicalUrl = `${buildRequestScopedStoreUrl(merchant, await headers())}/faq`;

  return {
    title: `FAQ | ${merchant.business_name}`,
    description: `Frequently asked questions about ${merchant.business_name}.`,
    openGraph: {
      title: `FAQ | ${merchant.business_name}`,
      description: `Find answers to common questions about ${merchant.business_name}.`,
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

/** Streams FAQ JSON-LD separately while the visible page content loads. */
export default function FAQPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <FAQJsonLd params={params} />
      </Suspense>
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

/** Streams FAQ JSON-LD structured data independently of page content. */
async function FAQJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) return null;

  const faqItems = extractFaqItems(merchant);
  if (faqItems.length === 0) return null;

  const faqSchema = generateFAQSchema(faqItems);

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is sanitized via safeJsonLdStringify
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
    />
  );
}

async function FAQContent({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const faqItems = extractFaqItems(merchant);
  if (faqItems.length === 0) {
    notFound();
  }

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
            <HelpComponent
              merchant={toTemplateMerchantData(merchant)}
              storeSlug={merchant.slug}
              isPreview={false}
            />
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
    <FAQPageClient
      merchant={merchant}
      faqItems={faqItems}
      legacyContent={!merchant.faq_items ? merchant.pages?.faq : undefined}
    />
  );
}
