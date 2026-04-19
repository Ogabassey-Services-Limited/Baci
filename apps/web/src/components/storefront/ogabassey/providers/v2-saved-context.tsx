'use client';

import type React from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Product } from '../types';

interface ToastState {
  show: boolean;
  message: string;
  type: 'add' | 'remove';
}

interface V2SavedContextType {
  savedItems: Product[];
  toggleSaved: (product: Product) => void;
  isSaved: (productId: number | string) => boolean;
  toastState: ToastState;
  dismissToast: () => void;
}

const V2SavedContext = createContext<V2SavedContextType | undefined>(undefined);
const SAVED_STORAGE_KEY = 'ogabassey_v2_saved';
const STORAGE_HYDRATION_TIMEOUT_MS = 1200;

export const useV2Saved = () => {
  const context = useContext(V2SavedContext);
  if (!context) {
    throw new Error('useV2Saved must be used within a V2SavedProvider');
  }
  return context;
};

export const V2SavedProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [savedItems, setSavedItems] = useState<Product[]>([]);
  const [hasHydratedStorage, setHasHydratedStorage] = useState(false);
  const [toastState, setToastState] = useState<ToastState>({
    show: false,
    message: '',
    type: 'add',
  });
  const hasHydratedStorageRef = useRef(false);

  const hydrateSavedItems = () => {
    if (typeof window === 'undefined' || hasHydratedStorageRef.current) {
      return null;
    }

    let nextSavedItems: Product[] = [];
    const stored = localStorage.getItem(SAVED_STORAGE_KEY);
    if (stored) {
      try {
        nextSavedItems = JSON.parse(stored);
      } catch (error) {
        console.error('Failed to parse saved items', error);
      }
    }

    hasHydratedStorageRef.current = true;
    setHasHydratedStorage(true);
    setSavedItems(nextSavedItems);
    return nextSavedItems;
  };

  useEffect(() => {
    if (typeof window === 'undefined' || hasHydratedStorageRef.current) {
      return undefined;
    }

    const activate = () => {
      detach();
      hydrateSavedItems();
    };

    const detach = () => {
      window.removeEventListener('pointerdown', activate);
      window.removeEventListener('keydown', activate);
      window.removeEventListener('scroll', activate);
    };

    window.addEventListener('pointerdown', activate, {
      once: true,
      passive: true,
    });
    window.addEventListener('keydown', activate, { once: true });
    window.addEventListener('scroll', activate, {
      once: true,
      passive: true,
    });

    const idleCallbackId =
      typeof window.requestIdleCallback === 'function'
        ? window.requestIdleCallback(activate, {
            timeout: STORAGE_HYDRATION_TIMEOUT_MS,
          })
        : undefined;
    const timeoutId = window.setTimeout(activate, STORAGE_HYDRATION_TIMEOUT_MS);

    return () => {
      detach();
      window.clearTimeout(timeoutId);
      if (idleCallbackId !== undefined) {
        window.cancelIdleCallback?.(idleCallbackId);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && hasHydratedStorage) {
      localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(savedItems));
    }
  }, [hasHydratedStorage, savedItems]);

  const toggleSaved = (product: Product) => {
    const hydratedSavedItems = hydrateSavedItems();

    setSavedItems((prev) => {
      const source = hydratedSavedItems ?? prev;
      // Ensure we compare IDs correctly (handle string/number mismatch if any)
      const exists = source.some((p) => String(p.id) === String(product.id));
      if (exists) {
        setToastState({
          show: true,
          message: 'Removed from Saved',
          type: 'remove',
        });
        return source.filter((p) => String(p.id) !== String(product.id));
      }
      setToastState({
        show: true,
        message: 'Added to Saved Items',
        type: 'add',
      });
      return [...source, product];
    });
  };

  const isSaved = (productId: number | string) => {
    return savedItems.some((p) => String(p.id) === String(productId));
  };

  const dismissToast = () => {
    setToastState((prev) => ({ ...prev, show: false }));
  };

  return (
    <V2SavedContext.Provider
      value={{ savedItems, toggleSaved, isSaved, toastState, dismissToast }}
    >
      {children}
    </V2SavedContext.Provider>
  );
};
