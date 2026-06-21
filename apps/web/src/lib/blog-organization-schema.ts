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

/**
 * Builds the standalone Organization (OnlineStore) JSON-LD node for blog
 * surfaces.
 *
 * Blog listing and post pages previously described the merchant only as a bare
 * `publisher` nested inside the BlogPosting/Blog schema — there was no top-level
 * brand entity carrying the store's `sameAs` social profiles or logo
 * dimensions, even though the storefront home page already emits one. Emitting
 * a consistent Organization node on the high-crawl blog surface lets search
 * engines resolve a single brand entity across the whole site. It reuses the
 * same `generateOrganizationSchema` builder as the home page so the entity
 * shape (`@type`, logo, `sameAs` logic) stays identical site-wide.
 *
 * The `WebSite` + `SearchAction` (sitelinks searchbox) node is intentionally
 * NOT emitted here: Google removed the sitelinks-searchbox visual element in
 * November 2024, so that markup no longer produces a rich result.
 */
export function buildBlogOrganizationSchema(
  merchant: BlogOrganizationMerchant,
  baseUrl: string
): Record<string, unknown> {
  return generateOrganizationSchema({
    name: merchant.business_name,
    url: baseUrl,
    logo: merchant.logo_url || undefined,
    country: merchant.country || undefined,
    socialMedia: merchant.social_media || undefined,
  });
}
