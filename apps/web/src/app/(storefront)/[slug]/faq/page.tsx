import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { sanitizeHtml } from '@/lib/sanitize';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { generateFAQSchema } from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';
import { type FAQItem, parseLegacyFAQ } from '@/types/faq';
import { FAQPageClient } from '../pages/faq/faq-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getMerchant(identifier: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const lookupKey = identifier.toLowerCase();

  if (isDomainIdentifier(identifier)) {
    const { data: domainData } = await supabase
      .from('domains')
      .select('merchant_id')
      .eq('domain', lookupKey)
      .eq('status', 'active')
      .single();

    if (!domainData) return null;

    const { data: merchant } = await supabase
      .from('merchants')
      .select('*')
      .eq('id', domainData.merchant_id)
      .single();

    return merchant;
  }

  const { data: merchant } = await supabase
    .from('merchants')
    .select('*')
    .eq('slug', lookupKey)
    .single();

  return merchant;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

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

export default async function FAQPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
      />
      <StorefrontPageWrapper
        pageName="Help"
        merchant={merchant}
        fallback={
          <FAQPageClient
            merchant={merchant}
            faqItems={faqItems.map((item) => ({
              ...item,
              answer: sanitizeHtml(item.answer),
            }))}
            legacyContent={
              !merchant.faq_items ? merchant.pages?.faq : undefined
            }
            sanitizedLegacyContent={
              !merchant.faq_items && merchant.pages?.faq
                ? sanitizeHtml(merchant.pages.faq)
                : undefined
            }
          />
        }
      />
    </>
  );
}
