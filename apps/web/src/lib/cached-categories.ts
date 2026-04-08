import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cacheTag } from 'next/cache';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

export interface CategoryNavItem {
  name: string;
  slug: string;
}

/**
 * Create a Supabase client for cached queries.
 * This client doesn't use cookies, so it's suitable for caching.
 */
function getPublicSupabaseClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  return createSupabaseClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Fetch top-level categories for navigation (server-side cached)
 * Uses unstable_cache for cross-request caching with 5-minute TTL
 * Should be called from server components with ISR
 */
export async function getCachedNavigationCategories(
  merchantId: string
): Promise<CategoryNavItem[]> {
  'use cache: remote';
  cacheTag('categories', 'navigation-categories');
  // Default cache life is sufficient, or use cacheLife if precise control needed

  const supabase = getPublicSupabaseClient();

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

  return categories.sort((a: CategoryNavItem, b: CategoryNavItem) => {
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
