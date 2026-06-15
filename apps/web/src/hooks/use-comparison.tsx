'use client';

import { createContext, type ReactNode, use, useState } from 'react';

interface ComparisonContextType {
  comparisonIds: Set<string>;
  isInComparison: (id: string) => boolean;
  toggleComparison: (id: string) => void;
  addToComparison: (id: string) => void;
  removeFromComparison: (id: string) => void;
  clearComparison: () => void;
}

const ComparisonContext = createContext<ComparisonContextType | undefined>(
  undefined
);

export function ComparisonProvider({ children }: { children: ReactNode }) {
  const [comparisonIds, setComparisonIds] = useState<Set<string>>(new Set());

  const isInComparison = (id: string) => comparisonIds.has(id);

  const toggleComparison = (id: string) => {
    setComparisonIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addToComparison = (id: string) => {
    setComparisonIds((prev) => new Set(prev).add(id));
  };

  const removeFromComparison = (id: string) => {
    setComparisonIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  const clearComparison = () => {
    setComparisonIds(new Set());
  };

  return (
    <ComparisonContext.Provider
      value={{
        comparisonIds,
        isInComparison,
        toggleComparison,
        addToComparison,
        removeFromComparison,
        clearComparison,
      }}
    >
      {children}
    </ComparisonContext.Provider>
  );
}

export function useComparison() {
  const context = use(ComparisonContext);
  if (context === undefined) {
    throw new Error('useComparison must be used within a ComparisonProvider');
  }
  return context;
}
