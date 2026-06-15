'use client';

import { createContext, type ReactNode, use, useState } from 'react';

interface StorefrontContextType {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
}

const StorefrontContext = createContext<StorefrontContextType | undefined>(
  undefined
);

export function StorefrontProvider({ children }: { children: ReactNode }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  return (
    <StorefrontContext.Provider
      value={{
        searchQuery,
        setSearchQuery,
        selectedCategory,
        setSelectedCategory,
      }}
    >
      {children}
    </StorefrontContext.Provider>
  );
}

export function useStorefront() {
  const context = use(StorefrontContext);
  if (context === undefined) {
    throw new Error('useStorefront must be used within a StorefrontProvider');
  }
  return context;
}

/**
 * Safe version of useStorefront that returns null instead of throwing
 * Use this in components that might render outside of StorefrontProvider (e.g., previews)
 */
export function useStorefrontSafe(): StorefrontContextType | null {
  const context = use(StorefrontContext);
  return context === undefined ? null : context;
}
