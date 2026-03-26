'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';
import type { Product } from '../types';

interface V2ComparisonContextType {
  compareItems: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: number | string) => void;
  isInCompare: (productId: number | string) => boolean;
  clearCompare: () => void;
}

const V2ComparisonContext = createContext<V2ComparisonContextType | undefined>(
  undefined
);

export const useV2Comparison = () => {
  const context = useContext(V2ComparisonContext);
  if (!context) {
    throw new Error(
      'useV2Comparison must be used within a V2ComparisonProvider'
    );
  }
  return context;
};

export const V2ComparisonProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [compareItems, setCompareItems] = useState<Product[]>([]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('ogabassey_v2_compare');
      if (stored) {
        try {
          setCompareItems(JSON.parse(stored));
        } catch (e) {
          console.error('Failed to parse comparison items', e);
        }
      }
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        'ogabassey_v2_compare',
        JSON.stringify(compareItems)
      );
    }
  }, [compareItems]);

  const addToCompare = (product: Product) => {
    setCompareItems((prev) => {
      // Avoid duplicates
      if (prev.some((p) => String(p.id) === String(product.id))) return prev;

      // Limit to 4 items for UI sanity (1 main + 3 comparisons)
      if (prev.length >= 4) {
        // Remove first, add new
        return [...prev.slice(1), product];
      }
      return [...prev, product];
    });
  };

  const removeFromCompare = (productId: number | string) => {
    setCompareItems((prev) =>
      prev.filter((p) => String(p.id) !== String(productId))
    );
  };

  const isInCompare = (productId: number | string) => {
    return compareItems.some((p) => String(p.id) === String(productId));
  };

  const clearCompare = () => setCompareItems([]);

  return (
    <V2ComparisonContext.Provider
      value={{
        compareItems,
        addToCompare,
        removeFromCompare,
        isInCompare,
        clearCompare,
      }}
    >
      {children}
    </V2ComparisonContext.Provider>
  );
};
