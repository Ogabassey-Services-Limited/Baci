import { buildBlogPublisherSameAs } from '@/lib/blog-publisher-same-as';
import { generateOrganizationSchema } from '@/lib/seo-utils';

interface BlogOrganizationMerchant {
  business_name: string;
  logo_url?: string | null;
  country?: string | null;
  social_media?: Record<string, unknown> | null;
}

export function buildBlogOrganizationId(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/, '')}#organization`;
}

// Blog pages emit one stable brand node without deprecated sitelinks-searchbox markup.
export function buildBlogOrganizationSchema(
  merchant: BlogOrganizationMerchant,
  baseUrl: string
): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    ...generateOrganizationSchema({
      name: merchant.business_name,
      url: baseUrl,
      logo: merchant.logo_url || undefined,
      country: merchant.country || undefined,
    }),
    '@id': buildBlogOrganizationId(baseUrl),
  };

  const sameAs = buildBlogPublisherSameAs(merchant.social_media);
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}
