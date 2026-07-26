import type { CategoryRouteContext } from './category-route-types';

export type ParentOwnershipResult =
  | 'owned'
  | 'absent'
  | 'retired'
  | 'nested'
  | 'lookup-failed';

/** Classify the parent's ownership and hierarchy status for this merchant. */
export async function isParentCategoryOwnedByMerchant(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  parentId: string
): Promise<ParentOwnershipResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, is_active, parent_id')
    .eq('id', parentId)
    .eq('merchant_id', merchantId)
    .maybeSingle<{
      id: string;
      is_active: boolean | null;
      parent_id: string | null;
    }>();

  if (error) return 'lookup-failed';
  if (!data) return 'absent';
  if (data.is_active === false) return 'retired';
  return data.parent_id === null ? 'owned' : 'nested';
}
