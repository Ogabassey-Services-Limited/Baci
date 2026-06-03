import { useQuery } from '@tanstack/react-query';
import { CONSTANT_MERCHANT_ID, log } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import { withSupabaseRetry } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { PageConfig } from '@/lib/validation/page-config-schema';
import { PageConfigSchema } from '@/lib/validation/page-config-schema';

const PAGE_CONFIG_STALE_TIME_MS = 1000 * 60 * 15;
const PAGE_CONFIG_GC_TIME_MS = 1000 * 60 * 60 * 24;

export function usePageConfig(slug: string = 'home') {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return useQuery<PageConfig | null>({
    queryKey: ['page_config', slug, merchantId],
    queryFn: async () => {
      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('page_configs')
            .select('published_config')
            .eq('merchant_id', merchantId)
            .eq('page_slug', slug)
            .eq('is_published', true)
            .maybeSingle(),
        {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            log.warn(`PageConfig retry ${attempt}: ${err.message}`);
          },
        }
      );

      if (error) throw error;
      if (!data?.published_config) {
        return null;
      }

      const parsed = PageConfigSchema.safeParse(data.published_config);
      if (!parsed.success) {
        log.warn('Invalid published page config payload', {
          slug,
          issues: parsed.error.format(),
        });
        return null;
      }

      return parsed.data;
    },
    staleTime: PAGE_CONFIG_STALE_TIME_MS,
    gcTime: PAGE_CONFIG_GC_TIME_MS,
    enabled: !!merchantId,
  });
}
