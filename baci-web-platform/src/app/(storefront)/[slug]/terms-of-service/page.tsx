import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { createClient } from '@/lib/supabase/server';
import { TermsPageClient } from '../pages/terms/terms-page-client';

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
      title: 'Terms of Service',
    };
  }

  return {
    title: `Terms of Service | ${merchant.business_name}`,
    description: `Terms of Service for ${merchant.business_name}. Please read these terms carefully before using our services.`,
    alternates: {
      canonical: `/${slug}/terms-of-service`,
    },
    openGraph: {
      title: `Terms of Service | ${merchant.business_name}`,
      description: `Terms of Service for ${merchant.business_name}. Please read these terms carefully before using our services.`,
      type: 'website',
      ...(merchant.logo_url && { images: [{ url: merchant.logo_url }] }),
    },
  };
}

export default async function TermsOfServicePage({ params }: PageProps) {
  const { slug } = await params;
  const merchant = await getMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Check if terms content exists OR template has Terms component
  const hasTermsContent = merchant.pages?.terms;
  const templateHasTermsPage = merchant.template_id === 'ogabassey';

  if (!hasTermsContent && !templateHasTermsPage) {
    notFound();
  }

  // Generate base URL for JSON-LD
  const isDevelopment = process.env.NODE_ENV === 'development';
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com';
  const baseUrl = isDevelopment
    ? `http://localhost:3000/${slug}`
    : `https://${slug}.${rootDomain}`;

  // Generate WebPage JSON-LD schema for Terms of Service
  const termsSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Terms of Service | ${merchant.business_name}`,
    url: `${baseUrl}/terms-of-service`,
    description: `Terms of Service for ${merchant.business_name}. Please read these terms carefully before using our services.`,
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
      {/* Terms of Service JSON-LD Schema */}
      <script
        type="application/ld+json"
        // codeql[js/html-injection] - Safe: JSON-LD sanitized via safeJsonLdStringify
        // nosemgrep: typescript.react.security.audit.react-dangerouslysetinnerhtml.react-dangerouslysetinnerhtml
        dangerouslySetInnerHTML={{ __html: safeJsonLdStringify(termsSchema) }}
      />
      <StorefrontPageWrapper
        pageName="Terms"
        merchant={merchant}
        fallback={
          <TermsPageClient
            merchant={merchant}
            content={merchant.pages?.terms}
          />
        }
      />
    </>
  );
}
