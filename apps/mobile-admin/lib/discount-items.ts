import { buildProductSearchQuery } from '@baci/shared';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';

export interface SelectableItem {
  id: string;
  name: string;
  description?: string;
  images: string[];
}

export async function fetchSelectableItems(params: {
  merchantId: string;
  type: 'product' | 'category';
  search: string;
}): Promise<SelectableItem[]> {
  const sanitizedSearch = sanitizeSearchQuery(
    buildProductSearchQuery(params.search).normalized
  );
  const searchTerm = `%${sanitizedSearch}%`;

  if (params.type === 'product') {
    const { data, error } = await supabase
      .from('products')
      .select('id, name, description, images')
      .eq('merchant_id', params.merchantId)
      .ilike('name', searchTerm)
      .limit(50);

    if (error) throw error;

    return ((data as SelectableItem[] | null) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      images: item.images || [],
    }));
  }

  const { data, error } = await supabase
    .from('categories')
    .select('id, name, description')
    .eq('merchant_id', params.merchantId)
    .ilike('name', searchTerm)
    .limit(50);

  if (error) throw error;

  return ((data as SelectableItem[] | null) ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    images: [],
  }));
}
