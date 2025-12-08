'use client';

import type { Product } from '@/lib/products';
import type React from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

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
    const [toastState, setToastState] = useState<ToastState>({
        show: false,
        message: '',
        type: 'add',
    });

    // Load from localStorage on mount (client-side only)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('ogabassey_v2_saved');
            if (stored) {
                try {
                    setSavedItems(JSON.parse(stored));
                } catch (e) {
                    console.error('Failed to parse saved items', e);
                }
            }
        }
    }, []);

    // Save to localStorage on change
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('ogabassey_v2_saved', JSON.stringify(savedItems));
        }
    }, [savedItems]);

    const toggleSaved = (product: Product) => {
        setSavedItems((prev) => {
            // Ensure we compare IDs correctly (handle string/number mismatch if any)
            const exists = prev.some((p) => String(p.id) === String(product.id));
            if (exists) {
                setToastState({
                    show: true,
                    message: 'Removed from Saved',
                    type: 'remove',
                });
                return prev.filter((p) => String(p.id) !== String(product.id));
            }
            setToastState({
                show: true,
                message: 'Added to Saved Items',
                type: 'add',
            });
            return [...prev, product];
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
