import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { JsonLd } from '@/components/seo/json-ld';
import { OgabasseyV2Repairs } from '@/components/storefront/ogabassey/pages/repairs';
import { GenericRepairsPage } from '@/components/storefront/repairs/GenericRepairsPage';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import {
  type CachedMerchant,
  getCachedMerchant,
  getCachedMerchantByDomain,
} from '@/lib/cached-data';
import { getRepairDevicesForMerchant } from '@/lib/repairs/repairs-catalog-data';
import { isRepairsCatalogEnabled } from '@/lib/repairs/repairs-feature';
import { generateBreadcrumbSchema } from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildStorefrontMetadataTitle } from '@/lib/storefront-metadata-title';
import { buildRepairsIndexSchema } from '@/lib/storefront-repairs/repairs-schema';
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

function isOgabasseyMerchant(merchant: CachedMerchant): boolean {
  return merchant.template_id === OGABASSEY_TEMPLATE_ID;
}

function isCatalogEnabledForMerchant(merchant: CachedMerchant): boolean {
  return isRepairsCatalogEnabled({
    businessType: merchant.business_type,
    repairsCatalogEnabled: merchant.feature_settings?.repairs_catalog_enabled,
  });
}

function shouldRenderRepairsPage(merchant: CachedMerchant): boolean {
  return isCatalogEnabledForMerchant(merchant);
}

export async function generateMetadata({
  params,
}: RepairsPageProps): Promise<Metadata> {
  const { slug } = await params;
  const merchant = await getRepairsMerchant(slug);

  if (!merchant || !shouldRenderRepairsPage(merchant)) {
    return {
      title: 'Repair Service Not Found',
    };
  }

  const baseUrl = buildStoreUrl(merchant);

  return {
    // Must stay distinct from /repair (the booking wizard): identical titles
    // across the two routes get flagged as duplicates by search engines and
    // audit tools. Absolute so the platform `%s | Baci` template never leaks
    // onto merchant storefronts.
    title: buildStorefrontMetadataTitle({
      title: `Device Repairs - ${merchant.business_name}`,
      fallback: 'Device Repairs',
    }).metadataTitle,
    description: `Explore phone, laptop, and gadget repair services from ${merchant.business_name} with expert technicians and genuine parts.`,
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

  if (!shouldRenderRepairsPage(merchant)) {
    notFound();
  }

  const baseUrl = buildStoreUrl(merchant);
  const canonicalUrl = `${baseUrl}/repairs`;
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: merchant.business_name || 'Home', url: baseUrl },
    { name: 'Repairs', url: canonicalUrl },
  ]);
  const basePath = getRepairsBasePath(await headers(), merchant);
  const catalogEnabled = isCatalogEnabledForMerchant(merchant);
  const groups = catalogEnabled
    ? await getRepairDevicesForMerchant(merchant.id).catch((error) => {
        console.error('Error loading repair devices for storefront:', error);
        return [];
      })
    : undefined;
  // Additive ItemList of device repair pages so crawlers/agents can discover
  // every per-device page from the index. Null when the catalogue is empty.
  const repairsIndexSchema = groups?.length
    ? buildRepairsIndexSchema({
        groups,
        merchantName: merchant.business_name,
        repairsUrl: canonicalUrl,
        storeBaseUrl: baseUrl,
      })
    : null;

  return (
    <>
      <JsonLd data={breadcrumbSchema} />
      {repairsIndexSchema && <JsonLd data={repairsIndexSchema} />}
      {isOgabasseyMerchant(merchant) ? (
        <OgabasseyV2Repairs basePath={basePath} groups={groups} />
      ) : (
        <GenericRepairsPage
          basePath={basePath}
          groups={groups ?? []}
          merchantName={merchant.business_name}
        />
      )}
    </>
  );
}
