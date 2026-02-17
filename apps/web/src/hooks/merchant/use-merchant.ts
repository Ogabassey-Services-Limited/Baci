'use client';

import { useContext } from 'react';
import { MerchantContext } from './merchant-provider';
import type { MerchantContextType } from './types';

export const useMerchant = (): MerchantContextType => {
  const context = useContext(MerchantContext);
  if (context === undefined) {
    throw new Error('useMerchant must be used within a MerchantProvider');
  }
  return context;
};

/**
 * Safe version of useMerchant that returns null instead of throwing.
 * Use in components that might render outside of MerchantProvider (e.g., previews).
 */
export const useMerchantSafe = (): MerchantContextType | null => {
  const context = useContext(MerchantContext);
  return context === undefined ? null : context;
};
