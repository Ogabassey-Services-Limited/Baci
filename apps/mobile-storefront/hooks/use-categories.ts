import { useQuery } from '@tanstack/react-query';
import { Category, CONSTANT_MERCHANT_ID, log } from '@/hooks/product-utils';
import { useMerchant } from '@/hooks/use-merchant';
import { withSupabaseRetry } from '@/lib/api';
import { supabase } from '@/lib/supabase';

export function useCategories() {
  const { data: merchant } = useMerchant();
  const merchantId = merchant?.id || CONSTANT_MERCHANT_ID;

  return useQuery({
    queryKey: ['categories', merchantId],
    queryFn: async () => {
      const { data, error } = await withSupabaseRetry(
        async () =>
          await supabase
            .from('categories')
            .select('id, name, slug, image_url')
            .eq('merchant_id', merchantId)
            .order('name'),
        {
          maxRetries: 3,
          onRetry: (attempt, err) => {
            log.warn(`Categories retry ${attempt}: ${err.message}`);
          },
        }
      );

      if (error) throw error;
      return (data as Category[]) || [];
    },
    staleTime: 1000 * 60 * 60,
    enabled: !!merchantId,
  });
}
