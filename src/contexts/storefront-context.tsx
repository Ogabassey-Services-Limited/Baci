'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface StorefrontContextType {
    searchQuery: string;
    setSearchQuery: (query: string) => void;
    selectedCategory: string;
    setSelectedCategory: (category: string) => void;
}

const StorefrontContext = createContext<StorefrontContextType | undefined>(undefined);

export function StorefrontProvider({ children }: { children: ReactNode }) {
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    return (
        <StorefrontContext.Provider value={{ searchQuery, setSearchQuery, selectedCategory, setSelectedCategory }}>
            {children}
        </StorefrontContext.Provider>
    );
}

export function useStorefront() {
    const context = useContext(StorefrontContext);
    if (context === undefined) {
        throw new Error('useStorefront must be used within a StorefrontProvider');
    }
    return context;
}
