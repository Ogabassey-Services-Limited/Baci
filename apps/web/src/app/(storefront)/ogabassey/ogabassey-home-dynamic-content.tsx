import Link from 'next/link';
import { mapHomeProductsToTemplateProducts } from '@/app/(storefront)/ogabassey/ogabassey-home-product-adapter';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { OGABASSEY_HOME_SCHEMA_PRODUCT_LIMIT } from '@/components/storefront/ogabassey/config/products';
import { createOgabasseyHomeProductFeed } from '@/components/storefront/ogabassey/home-product-feed';
import { OgabasseyHomePage } from '@/components/storefront/ogabassey/pages/home';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import {
  getCachedStorefrontHomeProducts,
  type getRequestScopedMerchant,
} from '@/lib/cached-data';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateCollectionPageSchema,
  generateLocalBusinessSchema,
  generateMetaDescription,
  generateOrganizationSchema,
  generateWebSiteSchema,
  getProductUrl,
  type LocalBusinessData,
  type OrganizationData,
} from '@/lib/seo-utils';
import { buildStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';

type OgabasseyMerchant = NonNullable<
  Awaited<ReturnType<typeof getRequestScopedMerchant>>
>;

interface OgabasseyHomeDynamicContentProps {
  merchant: OgabasseyMerchant;
  pathPrefix: string;
}

function buildOrganizationGraphSchema(merchant: OgabasseyMerchant) {
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
  const webSiteSchema = generateWebSiteSchema(
    merchant.business_name,
    baseUrl,
    `${baseUrl}/search?q={search_term_string}`
  );

  return {
    '@context': 'https://schema.org',
    '@graph': [organizationSchema, localBusinessSchema, webSiteSchema]
      .filter(Boolean)
      .map((schema) => {
        const { '@context': _, ...rest } = schema as Record<string, unknown>;
        return rest;
      }),
  };
}

export async function OgabasseyHomeDynamicContent({
  merchant,
  pathPrefix,
}: OgabasseyHomeDynamicContentProps) {
  const [products, categories] = await Promise.all([
    getCachedStorefrontHomeProducts(merchant.id),
    getCachedNavigationCategories(merchant.id),
  ]);
  const merchantProducts = mapHomeProductsToTemplateProducts(products || []);
  const baseUrl = buildStoreUrl(merchant);
  const homeCollectionSchema =
    merchantProducts.length > 0
      ? generateCollectionPageSchema({
          name: `${merchant.business_name} featured products`,
          description: generateMetaDescription(
            merchant.site_description ||
              merchant.site_tagline ||
              `Featured products from ${merchant.business_name}.`
          ),
          url: baseUrl,
          products: merchantProducts.slice(
            0,
            OGABASSEY_HOME_SCHEMA_PRODUCT_LIMIT
          ),
          merchantName: merchant.business_name,
          currency: merchant.payout_currency || 'NGN',
        })
      : null;
  const categoryDiscoveryLinks = Array.from(
    new Map(
      (categories || [])
        .map((category) => {
          const canonicalSlug = canonicalizeCategorySlug(category.slug);
          if (!canonicalSlug) return null;
          return [canonicalSlug, { ...category, slug: canonicalSlug }] as const;
        })
        .filter((entry): entry is NonNullable<typeof entry> => entry !== null)
    ).values()
  ).slice(0, 20);
  const productDiscoveryLinks = merchantProducts
    .filter((product) => product.slug?.trim())
    .map((product) => {
      const canonicalCategorySlug = product.category_slug
        ? canonicalizeCategorySlug(product.category_slug)
        : undefined;
      const path = getProductUrl({
        id: String(product.id),
        name: product.name,
        slug: product.slug,
        category: product.category,
        categories: product.categories,
        category_slug: canonicalCategorySlug,
      });

      return {
        id: String(product.id),
        name: product.name,
        href: path,
      };
    })
    .slice(0, 24);

  return (
    <>
      <script
        type="application/ld+json"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is escaped with safeJsonLdStringify for script context
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(buildOrganizationGraphSchema(merchant)),
        }}
      />
      {homeCollectionSchema ? (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema is escaped with safeJsonLdStringify for script context
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify(homeCollectionSchema),
          }}
        />
      ) : null}
      <AnalyticsProvider />
      <OgabasseyHomePage
        categories={categories || []}
        products={createOgabasseyHomeProductFeed(merchantProducts)}
        renderHero={false}
        storeSlug={merchant.slug}
      />
      <section
        aria-label="Storefront discovery links"
        className="mx-auto mt-8 max-w-[1400px] px-4 md:px-6"
      >
        <div className="rounded-2xl border border-[color-mix(in_srgb,var(--store-background-text,#111827)_10%,transparent)] bg-(--store-background,#ffffff) p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--store-background-text,#111827)_70%,transparent)]">
            Browse Popular Sections
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-[color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] px-3 py-1.5 text-xs font-medium text-[color-mix(in_srgb,var(--store-background-text,#111827)_80%,transparent)] transition-colors hover:border-(--store-primary) hover:text-(--store-primary)"
              href={asRoute(`${pathPrefix}/products`)}
              prefetch={false}
            >
              All Products
            </Link>
            {merchant.feature_settings?.blog_enabled ? (
              <Link
                className="rounded-full border border-[color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] px-3 py-1.5 text-xs font-medium text-[color-mix(in_srgb,var(--store-background-text,#111827)_80%,transparent)] transition-colors hover:border-(--store-primary) hover:text-(--store-primary)"
                href={asRoute(`${pathPrefix}/blog`)}
                prefetch={false}
              >
                Blog
              </Link>
            ) : null}
            {categoryDiscoveryLinks.map((category) => (
              <Link
                key={category.slug}
                className="rounded-full border border-[color-mix(in_srgb,var(--store-background-text,#111827)_15%,transparent)] px-3 py-1.5 text-xs font-medium text-[color-mix(in_srgb,var(--store-background-text,#111827)_80%,transparent)] transition-colors hover:border-(--store-primary) hover:text-(--store-primary)"
                href={asRoute(`${pathPrefix}/${category.slug}`)}
                prefetch={false}
              >
                {category.name}
              </Link>
            ))}
          </div>

          {productDiscoveryLinks.length > 0 && (
            <>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-[color-mix(in_srgb,var(--store-background-text,#111827)_55%,transparent)]">
                Featured Product Links
              </h3>
              <ul className="mt-2 grid gap-1 md:grid-cols-2 lg:grid-cols-3">
                {productDiscoveryLinks.map((link) => (
                  <li key={link.id}>
                    <Link
                      className="text-xs text-(--store-primary) underline-offset-4 hover:underline"
                      href={asRoute(`${pathPrefix}${link.href}`)}
                      prefetch={false}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </section>
    </>
  );
}
