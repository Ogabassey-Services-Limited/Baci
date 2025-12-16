import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';

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

    return data || [];
  }
);
