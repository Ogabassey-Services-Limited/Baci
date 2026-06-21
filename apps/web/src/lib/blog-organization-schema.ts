import { generateOrganizationSchema } from '@/lib/seo-utils';

interface BlogOrganizationMerchant {
  business_name: string;
  logo_url?: string | null;
  country?: string | null;
  social_media?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
  } | null;
}

export function buildBlogOrganizationId(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}#organization`;
}

// Blog pages emit one stable brand node without deprecated sitelinks-searchbox markup.
export function buildBlogOrganizationSchema(
  merchant: BlogOrganizationMerchant,
  baseUrl: string
): Record<string, unknown> {
  return {
    ...generateOrganizationSchema({
      name: merchant.business_name,
      url: baseUrl,
      logo: merchant.logo_url || undefined,
      country: merchant.country || undefined,
      socialMedia: merchant.social_media || undefined,
    }),
    '@id': buildBlogOrganizationId(baseUrl),
  };
}
