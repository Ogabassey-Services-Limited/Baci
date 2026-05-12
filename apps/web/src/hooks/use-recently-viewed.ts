'use client';

/**
 * React hook for tracking and displaying recently viewed products
 *
 * Stores product IDs in localStorage with timestamps, automatically
 * removing old entries and maintaining a configurable max size.
 */

import { useEffect, useState } from 'react';
import type { Product } from '@/lib/products';
import { useMerchantSafe } from './use-merchant-client';

// Re-export Product type for consumers of this hook
export type { Product };

interface RecentlyViewedEntry {
  productId: string;
  viewedAt: number; // Unix timestamp
}

interface UseRecentlyViewedOptions {
  /** Maximum number of products to store (default: 10) */
  maxItems?: number;
  /** Expiration time in days (default: 30) */
  expirationDays?: number;
  /** Exclude current product from the list */
  excludeProductId?: string;
}

interface UseRecentlyViewedReturn {
  /** List of recently viewed product IDs (newest first) */
  recentlyViewedIds: string[];
  /** Add a product to recently viewed */
  addToRecentlyViewed: (productId: string) => void;
  /** Clear all recently viewed products */
  clearRecentlyViewed: () => void;
  /** Check if a product is in recently viewed */
  isRecentlyViewed: (productId: string) => boolean;
  /** Number of recently viewed products */
  count: number;
}

const STORAGE_KEY_PREFIX = 'baci-recently-viewed';

/**
 * Get storage key scoped to merchant (or global if no merchant)
 */
function getStorageKey(merchantId?: string | null): string {
  if (merchantId) {
    return `${STORAGE_KEY_PREFIX}-${merchantId}`;
  }
  return STORAGE_KEY_PREFIX;
}

/**
 * Hook for tracking recently viewed products
 *
 * @example
 * // In product detail page
 * function ProductPage({ product }: { product: Product }) {
 *   const { addToRecentlyViewed } = useRecentlyViewed();
 *
 *   useEffect(() => {
 *     addToRecentlyViewed(product.id);
 *   }, [product.id, addToRecentlyViewed]);
 *
 *   return <div>...</div>;
 * }
 *
 * @example
 * // In recently viewed section
 * function RecentlyViewedSection({ currentProductId }: { currentProductId?: string }) {
 *   const { recentlyViewedIds } = useRecentlyViewed({
 *     excludeProductId: currentProductId,
 *     maxItems: 6
 *   });
 *
 *   // Fetch products by IDs and render...
 * }
 */
export function useRecentlyViewed(
  options: UseRecentlyViewedOptions = {}
): UseRecentlyViewedReturn {
  const { maxItems = 10, expirationDays = 30, excludeProductId } = options;
  const merchantContext = useMerchantSafe();
  const merchantId = merchantContext?.merchant?.id ?? null;

  const [entries, setEntries] = useState<RecentlyViewedEntry[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  const storageKey = getStorageKey(merchantId);
  const expirationMs = expirationDays * 24 * 60 * 60 * 1000;

  // Load from localStorage on mount - this is the standard pattern for syncing external state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed: RecentlyViewedEntry[] = JSON.parse(stored);
        const now = Date.now();

        // Filter out expired entries
        const validEntries = parsed.filter(
          (entry) => now - entry.viewedAt < expirationMs
        );

        // Update storage if we removed expired entries
        if (validEntries.length !== parsed.length) {
          localStorage.setItem(storageKey, JSON.stringify(validEntries));
        }

        setEntries(validEntries);
      }
    } catch (error) {
      console.error('Failed to load recently viewed products:', error);
    }
    setIsInitialized(true);
  }, [storageKey, expirationMs]);

  // Save to localStorage when entries change
  useEffect(() => {
    if (!isInitialized || typeof window === 'undefined') return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(entries));
    } catch (error) {
      console.error('Failed to save recently viewed products:', error);
    }
  }, [entries, storageKey, isInitialized]);

  const addToRecentlyViewed = (productId: string) => {
    setEntries((prev) => {
      // Remove existing entry for this product (if any)
      const filtered = prev.filter((entry) => entry.productId !== productId);

      // Add new entry at the beginning
      const newEntry: RecentlyViewedEntry = {
        productId,
        viewedAt: Date.now(),
      };

      // Keep only maxItems
      const updated = [newEntry, ...filtered].slice(0, maxItems);

      return updated;
    });
  };

  const clearRecentlyViewed = () => {
    setEntries([]);
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(storageKey);
      } catch (error) {
        console.error('Failed to clear recently viewed products:', error);
      }
    }
  };

  const isRecentlyViewed = (productId: string) => {
    return entries.some((entry) => entry.productId === productId);
  };

  // Compute IDs with exclusion filter
  let recentlyViewedIds = entries.map((entry) => entry.productId);
  if (excludeProductId) {
    recentlyViewedIds = recentlyViewedIds.filter(
      (id) => id !== excludeProductId
    );
  }

  return {
    recentlyViewedIds,
    addToRecentlyViewed,
    clearRecentlyViewed,
    isRecentlyViewed,
    count: recentlyViewedIds.length,
  };
}

/**
 * Utility function to get recently viewed IDs directly from localStorage
 * (useful for server components or non-React contexts)
 */
export function getRecentlyViewedIds(merchantId?: string | null): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const storageKey = getStorageKey(merchantId);
    const stored = localStorage.getItem(storageKey);

    if (!stored) return [];

    const entries: RecentlyViewedEntry[] = JSON.parse(stored);
    const expirationMs = 30 * 24 * 60 * 60 * 1000; // 30 days
    const now = Date.now();

    return entries
      .filter((entry) => now - entry.viewedAt < expirationMs)
      .map((entry) => entry.productId);
  } catch {
    return [];
  }
}
