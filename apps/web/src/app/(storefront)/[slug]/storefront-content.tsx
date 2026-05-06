import { headers } from 'next/headers';
import Link from 'next/link';
import { Suspense } from 'react';
import { resolveStorefrontTemplateId } from '@/app/(storefront)/[slug]/resolve-storefront-template';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import { OGABASSEY_HOME_SCHEMA_PRODUCT_LIMIT } from '@/components/storefront/ogabassey/config/products';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import {
  type CachedMerchant,
  getCachedStorefrontHomeProducts,
} from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import type { Product } from '@/lib/products';
import { asRoute } from '@/lib/routes';
import { safeJsonLdStringify } from '@/lib/sanitize-json-ld';
import {
  generateCollectionPageSchema,
  generateMetaDescription,
  getProductUrl,
} from '@/lib/seo-utils';
import { buildRequestScopedStoreUrl } from '@/lib/store-url';
import { canonicalizeCategorySlug } from '@/lib/storefront-canonical-url';
import type { TemplateComponents } from '@/templates/registry';

interface StorefrontContentProps {
  merchant: CachedMerchant;
  initialTheme?: V2ThemeMode;
}

interface ErrorReporter {
  captureException?: (
    error: unknown,
    context?: {
      extra?: Record<string, unknown>;
      tags?: Record<string, string>;
    }
  ) => void;
}

/**
 * Retrieve the global error reporter if one has been registered.
 * `__BACI_ERROR_REPORTER__` is an opt-in integration point: external
 * monitoring SDKs (e.g. Sentry) can attach a reporter at runtime.
 * When no reporter is registered, `getErrorReporter()` returns `null`
 * and all downstream callers gracefully skip reporting.
 */
function getErrorReporter(): ErrorReporter | null {
  const globalReporter = (
    globalThis as typeof globalThis & {
      __BACI_ERROR_REPORTER__?: ErrorReporter;
    }
  ).__BACI_ERROR_REPORTER__;

  return globalReporter?.captureException ? globalReporter : null;
}

function reportTemplateRenderFailure(context: {
  error: unknown;
  merchantId: string;
  templateId: string;
}) {
  const errorReporter = getErrorReporter();

  if (!errorReporter) {
    return;
  }

  errorReporter.captureException?.(context.error, {
    tags: {
      merchantId: context.merchantId,
      templateId: context.templateId,
    },
    extra: {
      merchantId: context.merchantId,
      templateId: context.templateId,
      source: 'storefront-template-render',
    },
  });
}

function warnMissingTemplate(context: {
  merchantId: string;
  merchantTemplateId?: string | null;
  resolvedTemplateId: string;
}) {
  console.warn(
    'Storefront template not found, falling back to default storefront:',
    {
      merchantId: context.merchantId,
      merchantTemplateId: context.merchantTemplateId,
      resolvedTemplateId: context.resolvedTemplateId,
    }
  );
}

async function loadGenericTemplateComponents(templateId: string) {
  const { getTemplate } = await import('@/templates/registry');
  const template = getTemplate(templateId);

  if (!template) {
    return null;
  }

  return template.getComponents();
}

async function loadOgabasseyHomeTemplateModules() {
  const [{ OgabasseyHomePage }, { createOgabasseyHomeProductFeed }] =
    await Promise.all([
      import('@/components/storefront/ogabassey/pages/home'),
      import('@/components/storefront/ogabassey/home-product-feed'),
    ]);

  return {
    createOgabasseyHomeProductFeed,
    OgabasseyHomePage,
  };
}

function renderOgabasseyHomeTemplate({
  categories,
  merchantProducts,
  modules,
  storeSlug,
}: {
  categories: { name: string; slug: string }[];
  merchantProducts: Product[];
  modules: Awaited<ReturnType<typeof loadOgabasseyHomeTemplateModules>>;
  storeSlug: string;
}) {
  const { createOgabasseyHomeProductFeed, OgabasseyHomePage } = modules;

  return (
    <OgabasseyHomePage
      storeSlug={storeSlug}
      products={createOgabasseyHomeProductFeed(merchantProducts)}
      categories={categories}
    />
  );
}

async function renderDefaultStorefrontWrapper({
  categories,
  initialTheme,
  merchantProducts,
}: {
  categories: { name: string; slug: string }[];
  initialTheme?: V2ThemeMode;
  merchantProducts: Product[];
}) {
  const { StorefrontWrapper } = await import('./storefront-wrapper');

  return (
    <StorefrontWrapper
      products={merchantProducts}
      categories={categories}
      initialTheme={initialTheme}
    />
  );
}

/**
 * Async Server Component that handles the heavy data fetching.
 * This component streams after the page shell is sent.
 * Wrapped in Suspense in the parent page.tsx.
 */
export async function StorefrontContent({
  merchant,
  initialTheme,
}: StorefrontContentProps) {
  // Resolve template early so we can start loading components in parallel with data fetches
  const templateId = resolveStorefrontTemplateId(
    merchant.template_id,
    merchant.business_type
  );
  const ogabasseyHomeTemplatePromise =
    templateId === OGABASSEY_TEMPLATE_ID
      ? loadOgabasseyHomeTemplateModules().catch((error) => {
          reportTemplateRenderFailure({
            error,
            merchantId: merchant.id,
            templateId,
          });
          console.error('Failed to load OgaBassey storefront template:', {
            merchantId: merchant.id,
            templateId,
            error,
          });
          return null;
        })
      : null;
  const genericComponentsPromise =
    templateId && templateId !== OGABASSEY_TEMPLATE_ID
      ? loadGenericTemplateComponents(templateId).catch((error) => {
          reportTemplateRenderFailure({
            error,
            merchantId: merchant.id,
            templateId,
          });
          console.error('Failed to load storefront template components:', {
            merchantId: merchant.id,
            templateId,
            error,
          });
          return null;
        })
      : null;

  // Parallel data fetching — both use remote cache
  const [products, categories] = await Promise.all([
    getCachedStorefrontHomeProducts(merchant.id),
    getCachedNavigationCategories(merchant.id),
  ]);

  const headersList = await headers();
  const pathPrefix =
    headersList.has('x-custom-domain') || headersList.has('x-merchant-slug')
      ? ''
      : `/${merchant.slug}`;

  // Transform products to match expected interface
  // biome-ignore lint/suspicious/noExplicitAny: DB result shape differs from Product interface
  const merchantProducts: Product[] = (products || []).map((p: any) => ({
    ...p,
    categories: p.product_categories?.[0]?.categories || null,
    product_categories: undefined,
  })) as unknown as Product[];
  const baseUrl = buildRequestScopedStoreUrl(merchant, headersList);
  const schemaProducts =
    templateId === OGABASSEY_TEMPLATE_ID
      ? merchantProducts.slice(0, OGABASSEY_HOME_SCHEMA_PRODUCT_LIMIT)
      : merchantProducts;
  const homeCollectionSchema =
    schemaProducts.length > 0
      ? generateCollectionPageSchema({
          name: `${merchant.business_name} featured products`,
          description: generateMetaDescription(
            merchant.site_description ||
              merchant.site_tagline ||
              `Featured products from ${merchant.business_name}.`
          ),
          url: baseUrl,
          products: schemaProducts,
          merchantName: merchant.business_name,
          currency: merchant.payout_currency || 'NGN',
        })
      : null;
  // Key each discovery link by its canonicalized slug (lowercase + trim only)
  // so case/whitespace duplicates collapse without affecting merchant-defined
  // slug shapes such as `home-and-garden` vs `home_and_garden`.
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
    // Skip legacy rows with missing slugs — getProductUrl would derive an
    // unresolvable slug from the name, generating 404s in discovery links.
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

  const homepageSchema = homeCollectionSchema ? (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: CollectionPage schema serialized with safeJsonLdStringify
      dangerouslySetInnerHTML={{
        __html: safeJsonLdStringify(homeCollectionSchema),
      }}
    />
  ) : null;
  const discoveryLinksSection = (
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
  );

  if (templateId) {
    if (templateId === OGABASSEY_TEMPLATE_ID) {
      try {
        const ogabasseyHomeTemplateModules = await ogabasseyHomeTemplatePromise;

        if (ogabasseyHomeTemplateModules) {
          return (
            <>
              {homepageSchema}
              <AnalyticsProvider />
              {renderOgabasseyHomeTemplate({
                storeSlug: merchant.slug,
                merchantProducts,
                categories: categories || [],
                modules: ogabasseyHomeTemplateModules,
              })}
              {discoveryLinksSection}
            </>
          );
        }
      } catch (error) {
        reportTemplateRenderFailure({
          error,
          merchantId: merchant.id,
          templateId,
        });
        console.error('Failed to server-render storefront template:', {
          merchantId: merchant.id,
          templateId,
          error,
        });
      }
    } else if (genericComponentsPromise) {
      try {
        const components: TemplateComponents | null =
          await genericComponentsPromise;

        if (components) {
          const TemplateHome = components.Home;
          const templateMerchant = toTemplateMerchantData(merchant);

          return (
            <>
              {homepageSchema}
              <AnalyticsProvider />
              <TemplateHome
                storeSlug={merchant.slug}
                merchant={templateMerchant}
                products={merchantProducts}
                categories={categories || []}
                isPreview={false}
                initialTheme={initialTheme}
              />
              {discoveryLinksSection}
            </>
          );
        }

        warnMissingTemplate({
          merchantId: merchant.id,
          merchantTemplateId: merchant.template_id,
          resolvedTemplateId: templateId,
        });
      } catch (error) {
        reportTemplateRenderFailure({
          error,
          merchantId: merchant.id,
          templateId,
        });
        console.error('Failed to server-render storefront template:', {
          merchantId: merchant.id,
          templateId,
          error,
        });
      }
    } else {
      warnMissingTemplate({
        merchantId: merchant.id,
        merchantTemplateId: merchant.template_id,
        resolvedTemplateId: templateId,
      });
    }
  }

  return (
    <>
      {homepageSchema}
      {
        await renderDefaultStorefrontWrapper({
          merchantProducts,
          categories: categories || [],
          initialTheme,
        })
      }
      {discoveryLinksSection}
    </>
  );
}

/**
 * Wrapper component with Suspense for streaming
 */
export function StreamingStorefrontContent(props: StorefrontContentProps) {
  return (
    <Suspense fallback={<StorefrontPageSkeleton />}>
      <StorefrontContent {...props} />
    </Suspense>
  );
}
