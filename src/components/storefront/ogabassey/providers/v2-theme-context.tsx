'use client';

import type React from 'react';
import { createContext, useContext, useState } from 'react';

export type V2ThemeMode = 'standard' | 'santa';

interface V2ThemeContextType {
  theme: V2ThemeMode;
  setTheme: (theme: V2ThemeMode) => void;
  toggleTheme: () => void;
}

const V2ThemeContext = createContext<V2ThemeContextType | undefined>(undefined);

export const useV2Theme = () => {
  const context = useContext(V2ThemeContext);
  if (!context) {
    throw new Error('useV2Theme must be used within a V2ThemeProvider');
  }
  return context;
};

export const V2ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [theme, setTheme] = useState<V2ThemeMode>('standard');

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'standard' ? 'santa' : 'standard'));
  };

  return (
    <V2ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </V2ThemeContext.Provider>
  );
};
