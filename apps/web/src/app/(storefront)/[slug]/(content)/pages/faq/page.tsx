import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { generateFAQSchema } from '@/lib/seo-utils';
import { getTemplate } from '@/templates/registry';
import { type FAQItem, parseLegacyFAQ } from '@/types/faq';
import { FAQPageClient } from './faq-page-client';

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
      title: 'FAQ',
    };
  }

  return {
    title: `Frequently Asked Questions | ${merchant.business_name}`,
    description: `Find answers to common questions about ${merchant.business_name}. Get help with orders, shipping, returns, and more.`,
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

/** Streams JSON-LD separately while the visible page content loads. */
export default function FAQPage({ params }: PageProps) {
  return (
    <>
      <Suspense fallback={null}>
        <FAQJsonLd params={params} />
      </Suspense>
      <FAQContent params={params} />
    </>
  );
}

/** Streams JSON-LD structured data independently of page content. */
async function FAQJsonLd({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) return null;

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

  if (faqItems.length === 0) return null;

  const faqSchema = generateFAQSchema(faqItems);

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
    />
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
              // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant is a superset of what template components need
              merchant={merchant as any}
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

  return (
    <FAQPageClient
      merchant={merchant}
      faqItems={faqItems}
      legacyContent={!merchant.faq_items ? merchant.pages?.faq : undefined}
    />
  );
}
