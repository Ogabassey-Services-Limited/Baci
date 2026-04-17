import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
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
  const description =
    merchant.site_description ||
    merchant.site_tagline ||
    `Welcome to ${merchant.business_name}`;
  const socialMedia = merchant.social_media as Record<string, string> | null;

  const socialMediaUrls: Record<string, string> = {};
  if (socialMedia) {
    if (socialMedia.facebook) {
      socialMediaUrls.facebook = `https://facebook.com/${encodeURIComponent(
        socialMedia.facebook.replace('@', '')
      )}`;
    }
    if (socialMedia.instagram) {
      socialMediaUrls.instagram = `https://instagram.com/${encodeURIComponent(socialMedia.instagram.replace('@', ''))}`;
    }
    if (socialMedia.twitter) {
      socialMediaUrls.twitter = `https://twitter.com/${encodeURIComponent(socialMedia.twitter.replace('@', ''))}`;
    }
    if (socialMedia.tiktok) {
      socialMediaUrls.tiktok = `https://www.tiktok.com/@${encodeURIComponent(socialMedia.tiktok.replace('@', ''))}`;
    }
    if (socialMedia.youtube) {
      socialMediaUrls.youtube = `https://youtube.com/${encodeURIComponent(socialMedia.youtube)}`;
    }
    if (socialMedia.linkedin) {
      socialMediaUrls.linkedin = `https://linkedin.com/company/${encodeURIComponent(socialMedia.linkedin)}`;
    }
  }

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
      Object.keys(socialMediaUrls).length > 0 ? socialMediaUrls : undefined,
  };

  const organizationData: OrganizationData = {
    name: merchant.business_name,
    description,
    url: baseUrl,
    logo: merchant.logo_url || undefined,
    email: merchant.email || undefined,
    telephone: merchant.phone || undefined,
    socialMedia:
      Object.keys(socialMediaUrls).length > 0 ? socialMediaUrls : undefined,
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

      <Suspense fallback={<StorefrontPageSkeleton />}>
        <StorefrontContent merchant={merchant} />
      </Suspense>
    </>
  );
}
