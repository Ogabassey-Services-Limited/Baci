import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useMerchant } from './useMerchant';

export function useCategories() {
  const { merchant } = useMerchant();

  return useQuery({
    enabled: !!merchant?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, slug')
        .eq('merchant_id', merchant?.id)
        // Legacy NULL rows remain active throughout the storefront. Exclude
        // only explicit tombstones so existing categories stay selectable.
        .not('is_active', 'is', false)
        .order('name');
      if (error) throw new Error(error.message);
      return data;
    },
    queryKey: ['categories', merchant?.id],
    staleTime: 1000 * 60 * 10,
  });
}
