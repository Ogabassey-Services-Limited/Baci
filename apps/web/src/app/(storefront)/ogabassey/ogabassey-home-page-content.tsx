import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { OGABASSEY_HOME_SCHEMA_PRODUCT_LIMIT } from '@/components/storefront/ogabassey/config/products';
import { createOgabasseyHomeProductFeed } from '@/components/storefront/ogabassey/home-product-feed';
import { OgabasseyHomePage } from '@/components/storefront/ogabassey/pages/home';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import {
  getCachedStorefrontHomeProducts,
  getRequestScopedMerchant,
} from '@/lib/cached-data';
import type { Product } from '@/lib/products';
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

type StorefrontHomeProduct = Awaited<
  ReturnType<typeof getCachedStorefrontHomeProducts>
>[number];

function mapHomeProductsToTemplateProducts(
  products: StorefrontHomeProduct[]
): Product[] {
  return products.map((product) => ({
    ...product,
    categories: product.product_categories?.[0]?.categories || null,
    product_categories: undefined,
  })) as unknown as Product[];
}

function buildOrganizationGraphSchema(
  merchant: NonNullable<Awaited<ReturnType<typeof getRequestScopedMerchant>>>
) {
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

export async function OgabasseyHomePageContent() {
  await connection();

  const merchant = await getRequestScopedMerchant(OGABASSEY_TEMPLATE_ID);

  if (!merchant) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  const [products, categories, headersList] = await Promise.all([
    getCachedStorefrontHomeProducts(merchant.id),
    getCachedNavigationCategories(merchant.id),
    headers(),
  ]);
  const pathPrefix =
    headersList.has('x-custom-domain') || headersList.has('x-merchant-slug')
      ? ''
      : `/${merchant.slug}`;
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
      const canonicalCategorySlug = canonicalizeCategorySlug(
        product.category_slug
      );
      const path = getProductUrl({
        id: String(product.id),
        name: product.name,
        slug: product.slug,
        category: product.category,
        categories: product.categories,
        category_slug: canonicalCategorySlug ?? undefined,
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
        // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD schema from sanitized merchant data
        dangerouslySetInnerHTML={{
          __html: safeJsonLdStringify(buildOrganizationGraphSchema(merchant)),
        }}
      />
      {homeCollectionSchema ? (
        <script
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: CollectionPage schema serialized with safeJsonLdStringify
          dangerouslySetInnerHTML={{
            __html: safeJsonLdStringify(homeCollectionSchema),
          }}
        />
      ) : null}
      <AnalyticsProvider />
      <OgabasseyHomePage
        categories={categories || []}
        products={createOgabasseyHomeProductFeed(merchantProducts)}
        storeSlug={merchant.slug}
      />
      <section
        aria-label="Storefront discovery links"
        className="mx-auto mt-8 max-w-[1400px] px-4 md:px-6"
      >
        <div className="rounded-2xl border border-[var(--store-background-text,#111827)]/10 bg-[var(--store-background,#ffffff)] p-5">
          <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--store-background-text,#111827)]/70">
            Browse Popular Sections
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              className="rounded-full border border-[var(--store-background-text,#111827)]/15 px-3 py-1.5 text-xs font-medium text-[var(--store-background-text,#111827)]/80 transition-colors hover:border-[var(--store-primary)] hover:text-[var(--store-primary)]"
              href={asRoute(`${pathPrefix}/products`)}
              prefetch={false}
            >
              All Products
            </Link>
            {merchant.feature_settings?.blog_enabled ? (
              <Link
                className="rounded-full border border-[var(--store-background-text,#111827)]/15 px-3 py-1.5 text-xs font-medium text-[var(--store-background-text,#111827)]/80 transition-colors hover:border-[var(--store-primary)] hover:text-[var(--store-primary)]"
                href={asRoute(`${pathPrefix}/blog`)}
                prefetch={false}
              >
                Blog
              </Link>
            ) : null}
            {categoryDiscoveryLinks.map((category) => (
              <Link
                key={category.slug}
                className="rounded-full border border-[var(--store-background-text,#111827)]/15 px-3 py-1.5 text-xs font-medium text-[var(--store-background-text,#111827)]/80 transition-colors hover:border-[var(--store-primary)] hover:text-[var(--store-primary)]"
                href={asRoute(`${pathPrefix}/${category.slug}`)}
                prefetch={false}
              >
                {category.name}
              </Link>
            ))}
          </div>

          {productDiscoveryLinks.length > 0 && (
            <>
              <h3 className="mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--store-background-text,#111827)]/55">
                Featured Product Links
              </h3>
              <ul className="mt-2 grid gap-1 md:grid-cols-2 lg:grid-cols-3">
                {productDiscoveryLinks.map((link) => (
                  <li key={link.id}>
                    <Link
                      className="text-xs text-[var(--store-primary)] underline-offset-4 hover:underline"
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
