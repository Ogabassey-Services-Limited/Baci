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

    // Exact priority order - matches "Shop by Category" dropdown in the Navbar
    // Categories are matched by checking if their name STARTS with these keywords
    const PRIORITY_ORDER = [
      'smartphones',
      'laptops',
      'tablets',
      'gaming',
      'wearables',
      'audio',
      'smart tvs',
      'monitors',
      'printers',
      'accessories',
      'desktops',
      'general',
    ];

    // Helper: find the best matching priority index for a category name
    const getPriorityIndex = (name: string): number => {
      const lowerName = name.toLowerCase();
      // First try exact match or starts-with match (more specific)
      for (let i = 0; i < PRIORITY_ORDER.length; i++) {
        if (
          lowerName === PRIORITY_ORDER[i] ||
          lowerName.startsWith(PRIORITY_ORDER[i])
        ) {
          return i;
        }
      }
      // Fallback: check if name contains the keyword (less specific)
      for (let i = 0; i < PRIORITY_ORDER.length; i++) {
        if (lowerName.includes(PRIORITY_ORDER[i])) {
          return i;
        }
      }
      return -1; // Not found
    };

    return categories.sort((a, b) => {
      const aIndex = getPriorityIndex(a.name);
      const bIndex = getPriorityIndex(b.name);

      // Both are priority categories -> sort by priority index
      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      // Only A is priority -> A comes first
      if (aIndex !== -1) return -1;

      // Only B is priority -> B comes first
      if (bIndex !== -1) return 1;

      // Neither is priority -> Alphabetical sort
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase());
    });
  }
);
