import { useQuery } from '@tanstack/react-query';
import { CONSTANT_MERCHANT_ID, log } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import { withSupabaseRetry } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { PageConfig } from '@/types/blocks';

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
      return (data?.published_config ?? null) as PageConfig | null;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!merchantId,
  });
}
