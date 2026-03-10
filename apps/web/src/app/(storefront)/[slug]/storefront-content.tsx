import { cookies } from 'next/headers';
import { Suspense } from 'react';
import { resolveStorefrontTemplateId } from '@/app/(storefront)/[slug]/resolve-storefront-template';
import { AnalyticsProvider } from '@/components/analytics/analytics-provider';
import type { V2ThemeMode } from '@/components/storefront/ogabassey/providers/v2-theme-context';
import { StorefrontPageSkeleton } from '@/components/ui/skeletons';
import { getCachedNavigationCategories } from '@/lib/cached-categories';
import type { CachedMerchant } from '@/lib/cached-data';
import { toTemplateMerchantData } from '@/lib/merchant-template-data';
import type { Product } from '@/lib/products';
import { createClient } from '@/lib/supabase/server';
import { getTemplate } from '@/templates/registry';
import { StorefrontWrapper } from './storefront-wrapper';

const STOREFRONT_PRODUCTS_LIMIT = 200;
const STOREFRONT_PRODUCTS_SELECT = `
      id,
      name,
      slug,
      description,
      price,
      compare_at_price,
      images,
      category,
      brand,
      condition,
      stock,
      product_categories(
        categories(name, slug)
      )
    `;
const STOREFRONT_FILTERED_PRODUCTS_SELECT = `
      id,
      name,
      slug,
      description,
      price,
      compare_at_price,
      images,
      category,
      brand,
      condition,
      stock,
      product_categories!inner(
        categories!inner(name, slug)
      )
    `;

interface StorefrontContentProps {
  merchant: CachedMerchant;
  initialTheme?: V2ThemeMode;
  categoryFilter?: string;
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

/**
 * Async Server Component that handles the heavy data fetching.
 * This component streams after the page shell is sent.
 * Wrapped in Suspense in the parent page.tsx.
 */
export async function StorefrontContent({
  merchant,
  initialTheme,
  categoryFilter,
}: StorefrontContentProps) {
  // Parallel data fetching for all non-critical data
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Resolve template early so we can start loading components in parallel with data fetches
  const templateId = resolveStorefrontTemplateId(
    merchant.template_id,
    merchant.business_type
  );
  const template = templateId ? getTemplate(templateId) : null;
  // Start template loading early so it runs in parallel with data fetches
  const componentsPromise = template ? template.getComponents() : null;
  const createProductsQuery = (selectClause: string) =>
    supabase
      .from('products')
      .select(selectClause)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .order('price', { ascending: false });

  // Define fetches
  // Keep the homepage and category-filtered fetches bounded to protect SSR.
  const filteredProductsQuery = categoryFilter
    ? createProductsQuery(STOREFRONT_FILTERED_PRODUCTS_SELECT).ilike(
        'product_categories.categories.name',
        categoryFilter
      )
    : createProductsQuery(STOREFRONT_PRODUCTS_SELECT);
  const productsPromise = filteredProductsQuery.limit(
    STOREFRONT_PRODUCTS_LIMIT
  );

  const categoriesPromise = getCachedNavigationCategories(merchant.id);

  // Execute all in parallel
  const [productsResult, categories] = await Promise.all([
    productsPromise,
    categoriesPromise,
  ]);

  // TODO: Google Places fetch will be added back when integrated with template
  // Currently removed as it was unused and blocking CI

  if (productsResult.error) {
    console.error('Failed to fetch storefront products:', {
      merchantId: merchant.id,
      categoryFilter,
      error: productsResult.error,
    });
  }

  const products = productsResult.error ? [] : productsResult.data;

  // Transform products to match expected interface
  // biome-ignore lint/suspicious/noExplicitAny: DB result shape differs from Product interface
  const merchantProducts: Product[] = (products || []).map((p: any) => ({
    ...p,
    categories: p.product_categories?.[0]?.categories || null,
    product_categories: undefined,
  })) as unknown as Product[];

  if (templateId) {
    if (template && componentsPromise) {
      try {
        const components = await componentsPromise;
        const TemplateHome = components.Home;
        const templateMerchant = toTemplateMerchantData(merchant);

        return (
          <>
            <AnalyticsProvider />
            <TemplateHome
              storeSlug={merchant.slug}
              merchant={templateMerchant}
              products={merchantProducts}
              categories={categories || []}
              isPreview={false}
              initialTheme={initialTheme}
            />
          </>
        );
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
    <StorefrontWrapper
      products={merchantProducts}
      categories={categories || []}
      initialTheme={initialTheme}
    />
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
