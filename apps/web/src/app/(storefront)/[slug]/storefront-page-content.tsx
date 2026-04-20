import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateLocalBusinessSchema,
  generateOrganizationSchema,
  generateWebSiteSchema,
  type LocalBusinessData,
  type OrganizationData,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';
import { isValidMerchantIdentifier } from '@/lib/validation';
import { StorefrontContent } from './storefront-content';

export async function StorefrontPageContent({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  if (!isValidMerchantIdentifier(slug)) {
    notFound();
  }

  const headersList = await headers();
  const originalPathname = headersList.get('x-pathname') || '/';
  const isHomepage =
    originalPathname === '/' || originalPathname === `/${slug}`;

  if (!isHomepage) {
    notFound();
  }

  const merchant = await getRequestScopedMerchant(slug);

  if (!merchant) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  const baseUrl = buildStoreUrl(merchant);
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Welcome to ${merchant.business_name}`;

  const businessData: LocalBusinessData = {
    name: merchant.business_name,
    description,
    url: baseUrl,
    logo: merchant.logo_url || undefined,
    telephone: merchant.phone || undefined,
    address: merchant.business_address
      ? {
          street: merchant.business_address,
          country: merchant.country || 'NG',
        }
      : undefined,
    socialMedia:
      Object.keys(trustProfile.socialLinks).length > 0
        ? trustProfile.socialLinks
        : undefined,
  };

  const organizationData: OrganizationData = {
    name: merchant.business_name,
    description,
    url: baseUrl,
    logo: merchant.logo_url || undefined,
    email: trustProfile.supportEmail || merchant.email || undefined,
    telephone: trustProfile.supportPhone || merchant.phone || undefined,
    country: merchant.country || 'NG',
    socialMedia:
      Object.keys(trustProfile.socialLinks).length > 0
        ? trustProfile.socialLinks
        : undefined,
    trustProfile,
  };

  const organizationSchema = generateOrganizationSchema(organizationData);
  const localBusinessSchema = merchant.business_address
    ? generateLocalBusinessSchema(businessData)
    : null;
  const searchUrlTemplate = `${baseUrl}/search?q={search_term_string}`;
  const webSiteSchema = generateWebSiteSchema(
    merchant.business_name,
    baseUrl,
    searchUrlTemplate
  );

  return (
    <>
      {(localBusinessSchema || webSiteSchema) && (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify({
              '@context': 'https://schema.org',
              '@graph': [organizationSchema, localBusinessSchema, webSiteSchema]
                .filter(Boolean)
                .map((schema) => {
                  const { '@context': _, ...rest } = schema as Record<
                    string,
                    unknown
                  >;
                  return rest;
                }),
            }),
          }}
        />
      )}

      <StorefrontContent merchant={merchant} />
    </>
  );
}
