import { CONSTANT_MERCHANT_ID, fetchProductsPage } from '@/hooks/product-utils';
import type {
  Category,
  ProductsPage,
  UseProductsOptions,
} from '@/hooks/product-utils';
import { withSupabaseRetry } from '@/lib/api';
import { createLogger } from '@/lib/logger';
import { queryClient } from '@/lib/query-client';
import { supabase } from '@/lib/supabase';
import {
  PageConfigSchema,
  type PageConfig,
} from '@/lib/validation/page-config-schema';

export const STARTUP_HOME_PRODUCTS_OPTIONS = {
  limit: 48,
} satisfies UseProductsOptions;

const STARTUP_HOME_PAGE_SLUG = 'home';
const log = createLogger('StartupStorefrontPrefetch');

let startupStorefrontDataPrefetchPromise: Promise<void> | null = null;

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
  return (data as Category[]) || [];
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
      staleTime: 1000 * 60 * 60,
    }),
    queryClient.prefetchQuery({
      queryKey: ['page_config', STARTUP_HOME_PAGE_SLUG, CONSTANT_MERCHANT_ID],
      queryFn: fetchStartupPageConfig,
      staleTime: 1000 * 60 * 5,
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
      staleTime: 1000 * 60 * 2,
    }),
  ]).then(() => undefined);

  return startupStorefrontDataPrefetchPromise;
}
