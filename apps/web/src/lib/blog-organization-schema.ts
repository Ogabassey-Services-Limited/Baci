import { buildBlogOrganizationId } from '@/lib/blog-organization-id';
import { buildBlogPublisherSameAs } from '@/lib/blog-publisher-same-as';
import type { JsonLdStructuredData } from '@/lib/json-ld-types';
import { generateOrganizationSchema } from '@/lib/seo-utils';

interface BlogOrganizationMerchant {
  business_name: string;
  logo_url?: string | null;
  country?: string | null;
  social_media?: Record<string, unknown> | null;
}

// Blog pages emit one stable brand node without deprecated sitelinks-searchbox markup.
export function buildBlogOrganizationSchema(
  merchant: BlogOrganizationMerchant,
  baseUrl: string
): JsonLdStructuredData {
  const schema: JsonLdStructuredData = {
    ...generateOrganizationSchema({
      name: merchant.business_name,
      url: baseUrl,
      logo: merchant.logo_url || undefined,
      country: merchant.country || undefined,
    }),
    '@id': buildBlogOrganizationId(baseUrl),
  };

  const sameAs = buildBlogPublisherSameAs(
    merchant.social_media,
    merchant.business_name
  );
  if (sameAs.length > 0) {
    schema.sameAs = sameAs;
  }

  return schema;
}
