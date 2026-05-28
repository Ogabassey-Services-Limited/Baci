import { notFound } from 'next/navigation';
import { TrustPolicyPageClient } from '@/components/storefront/trust/trust-policy-page-client';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import { getContactHref, getTrustRouteContext } from '../trust-route-context';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function ReturnsPageContent({ params }: PageProps) {
  const { slug } = await params;
  const context = await getTrustRouteContext(slug, { requestScopedUrl: true });

  if (!context) {
    notFound();
  }

  const returnPolicy = context.trustProfile.returnPolicy;

  const canonicalUrl = `${context.baseUrl}/returns`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: `Returns Policy | ${context.merchant.business_name}`,
    url: canonicalUrl,
    description:
      returnPolicy?.summary ||
      `Returns policy for ${context.merchant.business_name}.`,
    isPartOf: {
      '@type': 'WebSite',
      name: context.merchant.business_name,
      url: context.baseUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: context.merchant.business_name,
      url: context.baseUrl,
      ...(context.merchant.logo_url && { logo: context.merchant.logo_url }),
    },
    inLanguage: 'en',
    ...(context.merchant.updated_at
      ? { dateModified: context.merchant.updated_at }
      : {}),
  };

  return (
    <>
      <script type="application/ld+json">{safeJsonLdStringify(jsonLd)}</script>
      <TrustPolicyPageClient
        kind="returns"
        merchantName={context.merchant.business_name}
        contactHref={getContactHref(context.merchant, context.baseUrl)}
        trustProfile={context.trustProfile}
      />
    </>
  );
}
