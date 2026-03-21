import { useQuery } from '@tanstack/react-query';
import { CONSTANT_MERCHANT_ID, log } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import { withSupabaseRetry } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { PageConfigSchema } from '@/lib/validation/page-config-schema';
import type { PageConfig } from '@/lib/validation/page-config-schema';

export function usePageConfig(slug: string = 'home') {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return useQuery({
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
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantId,
  });
}
