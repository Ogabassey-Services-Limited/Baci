'use client';
// Template preview

import type React from 'react';
import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';
import type { Product } from '../types';

interface ToastState {
  show: boolean;
  message: string;
  type: 'add' | 'remove';
}

interface SavedContextType {
  savedItems: Product[];
  toggleSaved: (product: Product) => void;
  isSaved: (productId: number | string) => boolean;
  toastState: ToastState;
  dismissToast: () => void;
}

const SavedContext = createContext<SavedContextType | undefined>(undefined);

export const useSaved = () => {
  const context = useContext(SavedContext);
  if (!context) {
    throw new Error('useSaved must be used within a SavedProvider');
  }
  return context;
};

// localStorage-backed external store. Reading it through useSyncExternalStore
// (instead of mirroring into state from an effect) keeps the provider
// compatible with React Compiler memoization and avoids a cascading render.
const SAVED_STORAGE_KEY = 'ogabassey_saved';
const EMPTY_SAVED_ITEMS: Product[] = [];

let savedItemsCache: { raw: string | null; items: Product[] } = {
  raw: null,
  items: EMPTY_SAVED_ITEMS,
};
const savedItemsListeners = new Set<() => void>();

function subscribeToSavedItems(listener: () => void) {
  savedItemsListeners.add(listener);
  return () => {
    savedItemsListeners.delete(listener);
  };
}

function getSavedItemsSnapshot(): Product[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(SAVED_STORAGE_KEY);
  } catch {
    raw = null;
  }

  if (raw === savedItemsCache.raw) {
    return savedItemsCache.items;
  }

  let items: Product[] = EMPTY_SAVED_ITEMS;
  if (raw) {
    try {
      items = JSON.parse(raw) as Product[];
    } catch (e) {
      console.error('Failed to parse saved items', e);
    }
  }

  savedItemsCache = { raw, items };
  return items;
}

function getServerSavedItemsSnapshot(): Product[] {
  return EMPTY_SAVED_ITEMS;
}

function writeSavedItems(items: Product[]) {
  const raw = JSON.stringify(items);
  try {
    window.localStorage.setItem(SAVED_STORAGE_KEY, raw);
  } catch {
    // Keep the in-memory store updated even if persistence fails.
  }
  savedItemsCache = { raw, items };
  for (const listener of savedItemsListeners) {
    listener();
  }
}

export const SavedProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const savedItems = useSyncExternalStore(
    subscribeToSavedItems,
    getSavedItemsSnapshot,
    getServerSavedItemsSnapshot
  );
  const [toastState, setToastState] = useState<ToastState>({
    show: false,
    message: '',
    type: 'add',
  });

  const toggleSaved = (product: Product) => {
    const prev = getSavedItemsSnapshot();
    // Ensure we compare IDs correctly (handle string/number mismatch if any)
    const exists = prev.some((p) => String(p.id) === String(product.id));
    if (exists) {
      writeSavedItems(prev.filter((p) => String(p.id) !== String(product.id)));
      setToastState({
        show: true,
        message: 'Removed from Saved',
        type: 'remove',
      });
    } else {
      writeSavedItems([...prev, product]);
      setToastState({
        show: true,
        message: 'Added to Saved Items',
        type: 'add',
      });
    }
  };

  const isSaved = (productId: number | string) => {
    return savedItems.some((p) => String(p.id) === String(productId));
  };

  const dismissToast = () => {
    setToastState((prev) => ({ ...prev, show: false }));
  };

  return (
    <SavedContext.Provider
      value={{ savedItems, toggleSaved, isSaved, toastState, dismissToast }}
    >
      {children}
    </SavedContext.Provider>
  );
};
