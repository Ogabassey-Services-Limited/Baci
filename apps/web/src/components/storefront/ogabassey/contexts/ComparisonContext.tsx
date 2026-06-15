'use client';
// Template preview

import type React from 'react';
import { createContext, use, useSyncExternalStore } from 'react';
import type { Product } from '../types';

interface ComparisonContextType {
  compareItems: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: number | string) => void;
  isInCompare: (productId: number | string) => boolean;
  clearCompare: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(
  undefined
);

const COMPARE_STORAGE_KEY = 'ogabassey_compare';
const COMPARE_UPDATED_EVENT = 'ogabassey-compare-updated';
const EMPTY_COMPARE_SNAPSHOT = '[]';

// localStorage is the source of truth; useSyncExternalStore keeps render in
// sync with it without setState-in-effect (SSR renders the empty snapshot).
function subscribeToCompareStore(callback: () => void) {
  window.addEventListener(COMPARE_UPDATED_EVENT, callback);
  return () => window.removeEventListener(COMPARE_UPDATED_EVENT, callback);
}

function getCompareSnapshot(): string {
  try {
    return localStorage.getItem(COMPARE_STORAGE_KEY) ?? EMPTY_COMPARE_SNAPSHOT;
  } catch {
    return EMPTY_COMPARE_SNAPSHOT;
  }
}

function getCompareServerSnapshot(): string {
  return EMPTY_COMPARE_SNAPSHOT;
}

function parseCompareItems(snapshot: string): Product[] {
  try {
    const parsed = JSON.parse(snapshot) as Product[];
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Failed to parse comparison items', e);
    return [];
  }
}

function writeCompareItems(items: Product[]) {
  try {
    localStorage.setItem(COMPARE_STORAGE_KEY, JSON.stringify(items));
  } catch (e) {
    console.error('Failed to persist comparison items', e);
  }
  window.dispatchEvent(new Event(COMPARE_UPDATED_EVENT));
}

function addToCompare(product: Product) {
  const prev = parseCompareItems(getCompareSnapshot());

  // Avoid duplicates
  if (prev.some((p) => String(p.id) === String(product.id))) return;

  // Limit to 4 items for UI sanity (1 main + 3 comparisons)
  if (prev.length >= 4) {
    // Remove first, add new
    writeCompareItems([...prev.slice(1), product]);
    return;
  }
  writeCompareItems([...prev, product]);
}

function removeFromCompare(productId: number | string) {
  const prev = parseCompareItems(getCompareSnapshot());
  writeCompareItems(prev.filter((p) => String(p.id) !== String(productId)));
}

function clearCompare() {
  writeCompareItems([]);
}

export const useComparison = () => {
  const context = use(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
};

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const compareSnapshot = useSyncExternalStore(
    subscribeToCompareStore,
    getCompareSnapshot,
    getCompareServerSnapshot
  );
  const compareItems = parseCompareItems(compareSnapshot);

  const isInCompare = (productId: number | string) => {
    return compareItems.some((p) => String(p.id) === String(productId));
  };

  return (
    <ComparisonContext.Provider
      value={{
        compareItems,
        addToCompare,
        removeFromCompare,
        isInCompare,
        clearCompare,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
};
