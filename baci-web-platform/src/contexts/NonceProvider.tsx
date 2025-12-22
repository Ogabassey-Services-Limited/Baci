'use client';

import { MotionConfig } from 'framer-motion';
import { createContext, type ReactNode, useContext } from 'react';

interface NonceContextValue {
  nonce?: string;
}

const NonceContext = createContext<NonceContextValue | undefined>(undefined);

interface NonceProviderProps {
  nonce?: string;
  children: ReactNode;
}

/**
 * Provides nonce to Framer Motion for CSP compliance.
 * Framer Motion 11.0.9+ supports nonces via MotionConfig.
 */
export function NonceProvider({ nonce, children }: NonceProviderProps) {
  return (
    <NonceContext.Provider value={{ nonce }}>
      <MotionConfig nonce={nonce}>{children}</MotionConfig>
    </NonceContext.Provider>
  );
}

/**
 * Hook to access nonce value from NonceContext.
 * @throws Error if used outside NonceProvider
 */
export function useNonce() {
  const context = useContext(NonceContext);
  if (context === undefined) {
    throw new Error('useNonce must be used within a NonceProvider');
  }
  return context;
}
