'use client';

import { createContext, type ReactNode, use, useState } from 'react';

interface SavedContextType {
  savedIds: Set<string>;
  isSaved: (id: string) => boolean;
  toggleSaved: (id: string) => void;
  addSaved: (id: string) => void;
  removeSaved: (id: string) => void;
}

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export function SavedProvider({ children }: { children: ReactNode }) {
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const isSaved = (id: string) => savedIds.has(id);

  const toggleSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addSaved = (id: string) => {
    setSavedIds((prev) => new Set(prev).add(id));
  };

  const removeSaved = (id: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  };

  return (
    <SavedContext.Provider
      value={{ savedIds, isSaved, toggleSaved, addSaved, removeSaved }}
    >
      {children}
    </SavedContext.Provider>
  );
}

export function useSaved() {
  const context = use(SavedContext);
  if (context === undefined) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
}
