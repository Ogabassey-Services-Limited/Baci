import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { sanitizeHtml } from '@/lib/sanitize';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';
import { TermsPageClient } from '../pages/terms/terms-page-client';

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
    return { title: 'Terms of Service' };
  }

  return {
    title: `Terms of Service | ${merchant.business_name}`,
    description: `Terms of Service for ${merchant.business_name}. Read our terms and conditions.`,
    openGraph: {
      title: `Terms of Service | ${merchant.business_name}`,
      description: `Terms of Service for ${merchant.business_name}.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: '/terms',
    },
  };
}

export default async function TermsPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const hasTermsContent = merchant.pages?.terms;
  const templateHasTermsPage = merchant.template_id === 'ogabassey';

  if (!hasTermsContent && !templateHasTermsPage) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${merchant.slug}`
    : `https://${merchant.slug}.${rootDomain}`;

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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(termsSchema) }}
      />
      <StorefrontPageWrapper
        pageName="Terms"
        merchant={merchant}
        fallback={
          <TermsPageClient
            merchant={merchant}
            content={merchant.pages?.terms}
            sanitizedContent={
              merchant.pages?.terms
                ? sanitizeHtml(merchant.pages.terms)
                : undefined
            }
          />
        }
      />
    </>
  );
}
