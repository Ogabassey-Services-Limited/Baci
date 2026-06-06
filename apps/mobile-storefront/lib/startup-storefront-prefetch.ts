import type {
  Category,
  ProductsPage,
  UseProductsOptions,
} from '@/hooks/product-utils';
import { CONSTANT_MERCHANT_ID, fetchProductsPage } from '@/hooks/product-utils';
import { withSupabaseRetry } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import {
  type PageConfig,
  PageConfigSchema,
} from '@/lib/validation/page-config-schema';

export const STARTUP_HOME_PRODUCTS_OPTIONS = {
  limit: 12,
} satisfies UseProductsOptions;

const STARTUP_HOME_PAGE_SLUG = 'home';
const PRODUCTS_STALE_TIME_MS = 1000 * 60 * 2;
const CATEGORIES_STALE_TIME_MS = 1000 * 60 * 60;
const PAGE_CONFIG_STALE_TIME_MS = 1000 * 60 * 15;
const log = createLogger('StartupStorefrontPrefetch');

let startupStorefrontDataPrefetchPromise: Promise<void> | null = null;

function normalizeStartupCategory(value: unknown): Category | null {
  if (!value || typeof value !== 'object') return null;
  const category = value as Record<string, unknown>;
  if (
    typeof category.id === 'string' &&
    typeof category.name === 'string' &&
    typeof category.slug === 'string'
  ) {
    return {
      id: category.id,
      name: category.name,
      slug: category.slug,
      ...(typeof category.image_url === 'string'
        ? { image_url: category.image_url }
        : {}),
    };
  }

  return null;
}

export async function fetchStartupCategories(): Promise<Category[]> {
  const { data, error } = await withSupabaseRetry(
    async () =>
      await supabase
        .from('categories')
        .select('id, name, slug, image_url')
        .eq('merchant_id', CONSTANT_MERCHANT_ID)
        .order('name'),
    {
      maxRetries: 3,
      onRetry: (attempt, err) => {
        log.warn(`Categories prefetch retry ${attempt}: ${err.message}`);
      },
    }
  );

  if (error) throw error;
  return Array.isArray(data)
    ? data.flatMap((category) => {
        const normalizedCategory = normalizeStartupCategory(category);
        return normalizedCategory ? [normalizedCategory] : [];
      })
    : [];
}

export async function fetchStartupPageConfig(): Promise<PageConfig | null> {
  const { data, error } = await withSupabaseRetry(
    async () =>
      await supabase
        .from('page_configs')
        .select('published_config')
        .eq('merchant_id', CONSTANT_MERCHANT_ID)
        .eq('page_slug', STARTUP_HOME_PAGE_SLUG)
        .eq('is_published', true)
        .maybeSingle(),
    {
      maxRetries: 3,
      onRetry: (attempt, err) => {
        log.warn(`Page config prefetch retry ${attempt}: ${err.message}`);
      },
    }
  );

  if (error) throw error;
  if (!data?.published_config) return null;

  const parsed = PageConfigSchema.safeParse(data.published_config);
  if (!parsed.success) {
    log.warn('Invalid startup page config payload', {
      issues: parsed.error.format(),
      slug: STARTUP_HOME_PAGE_SLUG,
    });
    return null;
  }

  return parsed.data;
}

export function prefetchStartupStorefrontData(): Promise<void> {
  try {
    if (!CONSTANT_MERCHANT_ID) {
      return Promise.resolve();
    }

    if (startupStorefrontDataPrefetchPromise) {
      return startupStorefrontDataPrefetchPromise;
    }

    startupStorefrontDataPrefetchPromise = Promise.allSettled([
      queryClient.prefetchQuery({
        queryKey: ['categories', CONSTANT_MERCHANT_ID],
        queryFn: fetchStartupCategories,
        staleTime: CATEGORIES_STALE_TIME_MS,
      }),
      queryClient.prefetchQuery({
        queryKey: ['page_config', STARTUP_HOME_PAGE_SLUG, CONSTANT_MERCHANT_ID],
        queryFn: fetchStartupPageConfig,
        staleTime: PAGE_CONFIG_STALE_TIME_MS,
      }),
      queryClient.prefetchInfiniteQuery({
        queryKey: [
          'products',
          CONSTANT_MERCHANT_ID,
          STARTUP_HOME_PRODUCTS_OPTIONS,
        ],
        queryFn: ({ pageParam = 0 }) =>
          fetchProductsPage(
            CONSTANT_MERCHANT_ID,
            STARTUP_HOME_PRODUCTS_OPTIONS,
            Number(pageParam)
          ),
        getNextPageParam: (lastPage: ProductsPage) => lastPage.nextOffset,
        initialPageParam: 0,
        staleTime: PRODUCTS_STALE_TIME_MS,
      }),
    ]).then((results) => {
      if (results.some((result) => result.status === 'rejected')) {
        startupStorefrontDataPrefetchPromise = null;
      }
      return undefined;
    });

    return startupStorefrontDataPrefetchPromise;
  } catch (error) {
    startupStorefrontDataPrefetchPromise = null;
    log.warn('Startup storefront prefetch failed before scheduling', {
      error,
    });
    return Promise.resolve();
  }
}
