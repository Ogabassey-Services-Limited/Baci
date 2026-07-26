import type { CategoryRouteContext } from './category-route-types';

export type CategoryChildrenResult =
  | 'has-children'
  | 'no-children'
  | 'lookup-failed';

/** Check whether re-parenting a category would also move a child branch. */
export async function categoryHasChildren(
  supabase: CategoryRouteContext['supabase'],
  merchantId: string,
  categoryId: string
): Promise<CategoryChildrenResult> {
  const { data, error } = await supabase
    .from('categories')
    .select('id')
    .eq('merchant_id', merchantId)
    .eq('parent_id', categoryId)
    .not('is_active', 'is', false)
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (error) return 'lookup-failed';
  return data ? 'has-children' : 'no-children';
}
