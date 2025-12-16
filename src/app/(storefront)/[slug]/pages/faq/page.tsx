import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { generateFAQSchema } from '@/lib/seo-utils';
import { createClient } from '@/lib/supabase/server';
import { type FAQItem, parseLegacyFAQ } from '@/types/faq';
import { FAQPageClient } from './faq-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function getMerchant(slug: string) {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  const { data: merchant, error } = await supabase
    .from('merchants')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !merchant) {
    return null;
  }

  return merchant;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

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
  };
}

export default async function FAQPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Get FAQ items - try structured data first, then parse legacy content
  let faqItems: FAQItem[] = [];

  if (
    merchant.faq_items &&
    Array.isArray(merchant.faq_items) &&
    merchant.faq_items.length > 0
  ) {
    // Use structured FAQ items
    faqItems = merchant.faq_items as FAQItem[];
  } else if (merchant.pages?.faq) {
    // Parse legacy FAQ content
    faqItems = parseLegacyFAQ(merchant.pages.faq);
  }

  // If no FAQs available, show not found
  if (faqItems.length === 0) {
    notFound();
  }

  // Generate JSON-LD structured data for FAQPage
  const faqSchema = generateFAQSchema(faqItems);

  return (
    <>
      {/* FAQ JSON-LD Schema - enables FAQ rich results in Google */}
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema sanitized with safeJsonLdStringify()
        // codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(faqSchema) }}
      />
      <StorefrontPageWrapper
        pageName="Help"
        merchant={merchant}
        fallback={
          <FAQPageClient
            merchant={merchant}
            faqItems={faqItems}
            legacyContent={
              !merchant.faq_items ? merchant.pages?.faq : undefined
            }
          />
        }
      />
    </>
  );
}
