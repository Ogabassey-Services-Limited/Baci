import type { Metadata } from 'next';
import { cookies, headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { PrivacyPageClient } from '../pages/privacy/privacy-page-client';

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
      title: 'Privacy Policy',
    };
  }

  // Use request headers to determine the actual domain (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
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

export default async function PrivacyPolicyPage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check if privacy policy content exists OR template has Privacy component
  const hasPrivacyContent = merchant.pages?.privacy;
  const templateHasPrivacyPage = merchant.template_id === 'ogabassey';

  if (!hasPrivacyContent && !templateHasPrivacyPage) {
    notFound();
  }

  // Generate base URL for JSON-LD (supports custom domains)
  const headersList = await headers();
  const host = headersList.get('host') || `${slug}.usebaci.com`;
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}`;

  // Generate WebPage JSON-LD schema for Privacy Policy
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
    dateModified: merchant.updated_at || new Date().toISOString(),
  };

  return (
    <>
      {/* Privacy Policy JSON-LD Schema */}
      <script
        type="application/ld+json"
        // codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD is sanitized via safeJsonLdStringify
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(privacySchema) }}
      />
      <StorefrontPageWrapper
        pageName="Privacy"
        merchant={merchant}
        fallback={
          <PrivacyPageClient
            merchant={merchant}
            content={merchant.pages?.privacy}
          />
        }
      />
    </>
  );
}
