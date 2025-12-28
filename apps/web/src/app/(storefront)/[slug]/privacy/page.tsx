import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { sanitizeHtml } from '@/lib/sanitize';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { isDomainIdentifier } from '@/lib/validation';
import { PrivacyPageClient } from '../pages/privacy/privacy-page-client';

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
    return { title: 'Privacy Policy' };
  }

  return {
    title: `Privacy Policy | ${merchant.business_name}`,
    description: `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`,
    openGraph: {
      title: `Privacy Policy | ${merchant.business_name}`,
      description: `Privacy Policy for ${merchant.business_name}. Learn how we collect, use, and protect your personal information.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
    alternates: {
      canonical: '/privacy',
    },
  };
}

export default async function PrivacyPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const hasPrivacyContent = merchant.pages?.privacy;
  const templateHasPrivacyPage = merchant.template_id === 'ogabassey';

  if (!hasPrivacyContent && !templateHasPrivacyPage) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${merchant.slug}`
    : `https://${merchant.slug}.${rootDomain}`;

  const privacySchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Privacy Policy | ${merchant.business_name}`,
    url: `${baseUrl}/privacy`,
    description: `Privacy Policy for ${merchant.business_name}.`,
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
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(privacySchema) }}
      />
      <StorefrontPageWrapper
        pageName="Privacy"
        merchant={merchant}
        fallback={
          <PrivacyPageClient
            merchant={merchant}
            content={merchant.pages?.privacy}
            sanitizedContent={
              merchant.pages?.privacy
                ? sanitizeHtml(merchant.pages.privacy)
                : undefined
            }
          />
        }
      />
    </>
  );
}
