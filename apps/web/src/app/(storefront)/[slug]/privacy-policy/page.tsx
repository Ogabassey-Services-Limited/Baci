import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StorefrontPageWrapper } from '@/app/(storefront)/[slug]/storefront-page-wrapper';
import { getMerchantByIdentifier } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-core';
import { PrivacyPageClient } from '../pages/privacy/privacy-page-client';

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Normalize domain by stripping protocol and trailing slashes
 * Defense-in-depth: guards against malformed data in database
 */
function normalizeDomain(domain: string | null | undefined): string | null {
  if (!domain) return null;
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase();
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    return {
      title: 'Privacy Policy',
    };
  }

  // Derive canonical URL from merchant data (no headers() for PPR compatibility)
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const normalizedDomain = normalizeDomain(merchant.custom_domain);
  const host = normalizedDomain || `${slug}.usebaci.com`;
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

/**
 * Privacy Policy page content - wrapped in Suspense for PPR compatibility
 */
async function PrivacyPolicyContent({ slug }: { slug: string }) {
  const merchant = await getMerchantByIdentifier(slug);

  if (!merchant) {
    notFound();
  }

  // Check if privacy policy content exists OR template has Privacy component
  // biome-ignore lint/suspicious/noExplicitAny: Dynamic merchant pages structure
  const merchantPages = (merchant as any).pages;
  const hasPrivacyContent = merchantPages?.privacy;
  const templateHasPrivacyPage = merchant.template_id === 'ogabassey';

  if (!hasPrivacyContent && !templateHasPrivacyPage) {
    notFound();
  }

  // For JSON-LD, use merchant slug-based URL (custom domain handled by middleware)
  const protocol = process.env.NODE_ENV === 'development' ? 'http' : 'https';
  const normalizedDomain = normalizeDomain(merchant.custom_domain);
  const baseUrl = normalizedDomain
    ? `${protocol}://${normalizedDomain}`
    : `${protocol}://${slug}.usebaci.com`;

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
    // Only include dateModified when a real timestamp exists (avoid unstable "now" fallback)
    ...(() => {
      // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant type doesn't include updated_at
      const m = merchant as any;
      return m.updated_at ? { dateModified: m.updated_at as string } : {};
    })(),
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
            // biome-ignore lint/suspicious/noExplicitAny: CachedMerchant type differs from PrivacyPageClient prop type
            merchant={merchant as any}
            content={merchantPages?.privacy}
          />
        }
      />
    </>
  );
}

/**
 * Privacy Policy Page - 2026 PPR Pattern
 * Uses cached merchant data and Suspense boundary for optimal streaming
 */
export default async function PrivacyPolicyPage({ params }: PageProps) {
  const { slug } = await params;

  return (
    <Suspense fallback={<PrivacyPageSkeleton />}>
      <PrivacyPolicyContent slug={slug} />
    </Suspense>
  );
}

/**
 * Loading skeleton for privacy policy page
 */
// Static skeleton line IDs for stable React keys
const SKELETON_LINES = ['s1', 's2', 's3', 's4', 's5', 's6'] as const;

function PrivacyPageSkeleton() {
  return (
    <div className="container max-w-4xl mx-auto py-12 px-4 animate-pulse">
      <div className="h-10 w-64 bg-muted rounded mb-8" />
      <div className="space-y-4">
        {SKELETON_LINES.map((id) => (
          <div key={id} className="h-4 bg-muted rounded w-full" />
        ))}
      </div>
    </div>
  );
}
