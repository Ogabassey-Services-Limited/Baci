'use client';

import { createContext, useContext } from 'react';
import type { MerchantContextType } from './types';

export const MerchantContext = createContext<MerchantContextType | undefined>(
  undefined
);

export const useMerchant = (): MerchantContextType => {
  const context = useContext(MerchantContext);
  if (context === undefined) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
};

/**
 * Safe version of useMerchant that returns null instead of throwing.
 * Useful in components that may render outside merchant context.
 */
export const useMerchantSafe = (): MerchantContextType | null => {
  return useContext(MerchantContext) ?? null;
};
