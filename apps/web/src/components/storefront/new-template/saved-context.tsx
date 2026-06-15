import type React from 'react';
import { createContext, use, useState } from 'react';

const SavedContext = createContext<any>(null);

export const SavedProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [savedItems, setSavedItems] = useState<number[]>([]);

  const toggleSaved = (product: any) => {
    const id =
      typeof product.id === 'string'
        ? Number.parseInt(product.id, 10)
        : product.id;
    setSavedItems((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const isSaved = (id: number | string) => {
    const numId = typeof id === 'string' ? Number.parseInt(id, 10) : id;
    return savedItems.includes(numId);
  };

  return (
    <SavedContext.Provider value={{ savedItems, toggleSaved, isSaved }}>
      {children}
    </SavedContext.Provider>
  );
};

export const useSaved = () => {
  const context = use(SavedContext);
  if (!context) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
};
