import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { OgabasseyV2Repairs } from '@/components/storefront/ogabassey/pages/repairs';
import {
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import {
  isDomainIdentifier,
  isValidMerchantIdentifier,
} from '@/lib/validation';

interface RepairsPageProps {
  params: Promise<{ slug: string }>;
}

async function getRepairsMerchant(slug: string) {
  if (!isValidMerchantIdentifier(slug)) {
    return null;
  }

  const lookupKey = slug.toLowerCase();
  return isDomainIdentifier(slug)
    ? await getCachedMerchantByDomain(lookupKey)
    : await getCachedMerchant(lookupKey);
}

export async function generateMetadata({
  params,
}: RepairsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getRepairsMerchant(slug);

  if (merchant?.template_id !== 'ogabassey') {
    return {
      title: 'Repair Service Not Found',
    };
  }

  const baseUrl = buildStoreUrl(merchant);

  return {
    title: `Book a Repair - ${merchant.business_name}`,
    description: `Schedule a device repair with ${merchant.business_name}`,
    alternates: {
      canonical: `${baseUrl}/repairs`,
    },
  };
}

function getRepairsBasePath(
  headersList: { get(name: string): string | null },
  merchant: { custom_domain?: string | null; slug: string }
): string {
  const requestMerchantSlug = headersList.get('x-merchant-slug')?.toLowerCase();
  const merchantSlug = merchant.slug.toLowerCase();
  const requestCustomDomain = headersList.get('x-custom-domain')?.toLowerCase();
  const merchantCustomDomain = merchant.custom_domain?.toLowerCase();
  const servedAtDomainRoot =
    requestMerchantSlug === merchantSlug ||
    (requestCustomDomain != null &&
      requestCustomDomain.length > 0 &&
      requestCustomDomain === merchantCustomDomain);

  return servedAtDomainRoot ? '' : `/${merchant.slug}`;
}

export default async function RepairsPage({ params }: RepairsPageProps) {
  const { slug } = await params;
  const merchant = await getRepairsMerchant(slug);

  if (!merchant) {
    notFound();
  }

  // Only show for Ogabassey template (merchant-specific feature)
  if (merchant.template_id !== 'ogabassey') {
    notFound();
  }

  const baseUrl = buildStoreUrl(merchant);
  const canonicalUrl = `${baseUrl}/repairs`;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: merchant.business_name || 'Home', url: baseUrl },
    { name: 'Repairs', url: canonicalUrl },
  ]);

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      <OgabasseyV2Repairs
        basePath={getRepairsBasePath(await headers(), merchant)}
      />
    </>
  );
}
