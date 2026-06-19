import { buildProductSearchQuery } from '@baci/shared';
import { fetchAdminProductSearchRows } from '@/lib/product-search';
import { sanitizeSearchQuery } from '@/lib/sanitize';
import { supabase } from '@/lib/supabase';

export interface SelectableItem {
  id: string;
  name: string;
  description?: string;
  images: string[];
}

interface SelectableProductRow extends Omit<SelectableItem, 'images'> {
  images: string[] | null;
}

const SELECTABLE_PRODUCT_COLUMNS = 'id, name, description, images';
const SELECTABLE_CATEGORY_COLUMNS = 'id, name, description';
const SELECTABLE_ITEM_LIMIT = 50;

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
    if (sanitizedSearch) {
      const page = await fetchAdminProductSearchRows<SelectableProductRow>({
        cursor: 0,
        filters: { search: sanitizedSearch },
        merchantId: params.merchantId,
        pageSize: SELECTABLE_ITEM_LIMIT,
        selectColumns: SELECTABLE_PRODUCT_COLUMNS,
      });

      return page.rows.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        images: item.images || [],
      }));
    }

    const { data, error } = await supabase
      .from('products')
      .select(SELECTABLE_PRODUCT_COLUMNS)
      .eq('merchant_id', params.merchantId)
      .ilike('name', searchTerm)
      .limit(SELECTABLE_ITEM_LIMIT);

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
    .select(SELECTABLE_CATEGORY_COLUMNS)
    .eq('merchant_id', params.merchantId)
    .ilike('name', searchTerm)
    .limit(SELECTABLE_ITEM_LIMIT);

  if (error) throw error;

  return ((data as SelectableItem[] | null) ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    images: [],
  }));
}
