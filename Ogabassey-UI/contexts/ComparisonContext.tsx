
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';

interface ComparisonContextType {
  compareItems: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: number | string) => void;
  isInCompare: (productId: number | string) => boolean;
  clearCompare: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(undefined);

export const useComparison = () => {
  const context = useContext(ComparisonContext);
  if (!context) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
};

export const ComparisonProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [compareItems, setCompareItems] = useState<Product[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('ogabassey_compare');
    if (stored) {
      try {
        setCompareItems(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse comparison items", e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('ogabassey_compare', JSON.stringify(compareItems));
  }, [compareItems]);

  const addToCompare = (product: Product) => {
    setCompareItems(prev => {
      // Avoid duplicates
      if (prev.some(p => String(p.id) === String(product.id))) return prev;
      
      // Limit to 4 items for UI sanity (1 main + 3 comparisons)
      if (prev.length >= 4) {
          // Remove first, add new
          return [...prev.slice(1), product];
      }
      return [...prev, product];
    });
  };

  const removeFromCompare = (productId: number | string) => {
    setCompareItems(prev => prev.filter(p => String(p.id) !== String(productId)));
  };

  const isInCompare = (productId: number | string) => {
    return compareItems.some(p => String(p.id) === String(productId));
  };

  const clearCompare = () => setCompareItems([]);

  return (
    <ComparisonContext.Provider value={{ compareItems, addToCompare, removeFromCompare, isInCompare, clearCompare }}>
      {children}
    </ComparisonContext.Provider>
  );
};
