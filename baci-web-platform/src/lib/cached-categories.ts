import { cookies } from 'next/headers';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';

export interface CategoryNavItem {
  name: string;
  slug: string;
}

/**
 * Fetch top-level categories for navigation (server-side cached)
 * Uses Next.js cache() for deduplication within a single request
 * Should be called from server components with ISR
 */
export const getCachedNavigationCategories = cache(
  async (merchantId: string): Promise<CategoryNavItem[]> => {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data, error } = await supabase
      .from('categories')
      .select('name, slug')
      .eq('merchant_id', merchantId)
      .is('parent_id', null) // Only top-level categories
      .order('name');

    if (error) {
      console.error('Failed to fetch navigation categories:', error);
      return [];
    }

    const categories = data || [];

    // Priority order for "Interest-Based" sorting
    const PRIORITY_ORDER = [
      'smartphones',
      'phones',
      'laptops',
      'computers',
      'tablets',
      'ipads',
      'gaming',
      'consoles',
      'smart watches',
      'wearables',
      'audio',
      'speakers',
      'headphones',
      'televisions',
      'tvs',
      'monitors',
      'printers',
      'accessories', // Accessories usually go last in "Interest" hierarchy
      'others',
    ];

    return categories.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      const aIndex = PRIORITY_ORDER.findIndex((p) => aName.includes(p));
      const bIndex = PRIORITY_ORDER.findIndex((p) => bName.includes(p));

      // Both are priority categories -> sort by priority index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // Only A is priority -> A comes first
      if (aIndex !== -1) return -1;

      // Only B is priority -> B comes first
      if (bIndex !== -1) return 1;

      // Neither is priority -> Alphabetical sort
      return aName.localeCompare(bName);
    });
  }
);
