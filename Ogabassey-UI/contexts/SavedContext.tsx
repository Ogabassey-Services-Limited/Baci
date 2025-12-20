
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';

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

export const SavedProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [savedItems, setSavedItems] = useState<Product[]>([]);
  const [toastState, setToastState] = useState<ToastState>({ show: false, message: '', type: 'add' });

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('ogabassey_saved');
    if (stored) {
      try {
        setSavedItems(JSON.parse(stored));
      } catch (e) {
        console.error("Failed to parse saved items", e);
      }
    }
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    localStorage.setItem('ogabassey_saved', JSON.stringify(savedItems));
  }, [savedItems]);

  const toggleSaved = (product: Product) => {
    setSavedItems(prev => {
      // Ensure we compare IDs correctly (handle string/number mismatch if any)
      const exists = prev.some(p => String(p.id) === String(product.id));
      if (exists) {
        setToastState({ show: true, message: 'Removed from Saved', type: 'remove' });
        return prev.filter(p => String(p.id) !== String(product.id));
      } else {
        setToastState({ show: true, message: 'Added to Saved Items', type: 'add' });
        return [...prev, product];
      }
    });
  };

  const isSaved = (productId: number | string) => {
    return savedItems.some(p => String(p.id) === String(productId));
  };

  const dismissToast = () => {
      setToastState(prev => ({ ...prev, show: false }));
  };

  return (
    <SavedContext.Provider value={{ savedItems, toggleSaved, isSaved, toastState, dismissToast }}>
      {children}
    </SavedContext.Provider>
  );
};
