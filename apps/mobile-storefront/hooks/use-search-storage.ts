/**
 * useSearchStorage Hook
 * Manages search history and preferences persistence
 *
 * 2026 Best Practices:
 * - Specific type guards for storage validation
 * - Error boundary safe
 * - Syncs across instances via storage events (if needed)
 */

import { useEffect, useState } from 'react';
import { syncStorage as storage } from '@/lib/storage'; // Assuming this is the correct import based on search.tsx analysis

const SEARCH_HISTORY_KEY = 'search_history';
const MAX_SEARCH_HISTORY = 10;

const DEFAULT_SEARCHES = [
  'iPhone 15 Pro',
  'Samsung Galaxy S24',
  'AirPods Pro',
  'MacBook Air',
  'Apple Watch',
];

export function useSearchStorage() {
  const [recentSearches, setRecentSearches] =
    useState<string[]>(DEFAULT_SEARCHES);

  // Load initial history
  useEffect(() => {
    try {
      const saved = storage.getItem(SEARCH_HISTORY_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.every((item): item is string => typeof item === 'string')
        ) {
          setRecentSearches(parsed);
        }
      }
    } catch (e) {
      // Fail silently, use defaults
      console.warn('Failed to load search history', e);
    }
  }, []);

  const saveSearch = (searchTerm: string) => {
    if (!searchTerm.trim() || searchTerm.length < 2) return;

    setRecentSearches((prev) => {
      // Remove duplicates and add to front
      const filtered = prev.filter(
        (s) => s.toLowerCase() !== searchTerm.toLowerCase()
      );
      const updated = [searchTerm, ...filtered].slice(0, MAX_SEARCH_HISTORY);

      // Persist to storage
      try {
        storage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to save search history', e);
      }

      return updated;
    });
  };

  const clearHistory = () => {
    setRecentSearches([]);
    try {
      storage.removeItem(SEARCH_HISTORY_KEY);
    } catch (e) {
      console.warn('Failed to clear search history', e);
    }
  };

  return {
    recentSearches,
    saveSearch,
    clearHistory,
  };
}
